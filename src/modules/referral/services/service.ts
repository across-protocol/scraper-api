import { CACHE_MANAGER, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, IsNull, LessThanOrEqual, Not, Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { performance } from "perf_hooks";
import Bluebird from "bluebird";
import { ethers } from "ethers";
import { Cache } from "cache-manager";

import { Deposit } from "../../deposit/model/deposit.entity";
import { AppConfig } from "../../configuration/configuration.service";
import { DepositsFilteredReferrals } from "../model/DepositsFilteredReferrals.entity";
import { DepositReferralStat } from "../../deposit/model/deposit-referral-stat.entity";
import { splitArrayInChunks } from "../../../utils";
import { Claim } from "../../airdrop/model/claim.entity";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { ChainIds } from "../../web3/model/ChainId";
import { RewardsWindowJob } from "../../rewards/model/RewardsWindowJob.entity";
import { ReferralRewardsWindowJobResult } from "../../rewards/model/RewardsWindowJobResult.entity";

const REFERRAL_ADDRESS_DELIMITER = "d00dfeeddeadbeef";

@Injectable()
export class ReferralService {
  private logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(RewardsWindowJob)
    readonly referralRewardsWindowJobRepository: Repository<RewardsWindowJob>,
    @InjectRepository(ReferralRewardsWindowJobResult)
    readonly referralRewardsWindowJobResultRepository: Repository<ReferralRewardsWindowJobResult>,
    private ethProvidersService: EthProvidersService,
    private appConfig: AppConfig,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  public async revertReferralsMerkleDistribution(windowIndex: number) {
    await this.depositRepository.update({ rewardsWindowIndex: windowIndex }, { rewardsWindowIndex: null });
  }

  public getTierLevelByRate(referralRate: number) {
    if (referralRate === 0.8) {
      return 5;
    }
    if (referralRate === 0.7) {
      return 4;
    }
    if (referralRate === 0.6) {
      return 3;
    }
    if (referralRate === 0.5) {
      return 2;
    }
    return 1;
  }

  private getTierLevelAndBonus(transfersCount: number, transfersVolumeUsd: number) {
    if (transfersCount >= 20 || transfersVolumeUsd >= 500000) {
      return { referralRate: 0.8, tier: 5 };
    }
    if (transfersCount >= 10 || transfersVolumeUsd >= 250000) {
      return { referralRate: 0.7, tier: 4 };
    }
    if (transfersCount >= 5 || transfersVolumeUsd >= 100000) {
      return { referralRate: 0.6, tier: 3 };
    }
    if (transfersCount >= 3 || transfersVolumeUsd >= 50000) {
      return { referralRate: 0.5, tier: 2 };
    }

    return { referralRate: 0.4, tier: 1 };
  }

  /**
   * Returns the calldata string without the arguments of the deposit function
   * @param data
   */
  public subtractFunctionArgsFromCallData(data: string) {
    // the length of the string including the method identifier and
    // the deposit function args ["address", "address", "uint256", "uint256", "uint64", "uint32"]
    const methodIdAndArgsLength = 395;
    return data.slice(methodIdAndArgsLength - 1);
  }

  public extractReferralAddressUsingDelimiter(data: string) {
    const referralData = this.subtractFunctionArgsFromCallData(data);

    if (referralData.indexOf(REFERRAL_ADDRESS_DELIMITER) !== -1) {
      const addressIndex = referralData.indexOf(REFERRAL_ADDRESS_DELIMITER) + REFERRAL_ADDRESS_DELIMITER.length;
      const potentialAddress = referralData.slice(addressIndex, addressIndex + 40);

      if (potentialAddress.length === 40) {
        const address = ethers.utils.getAddress(`0x${potentialAddress}`);
        return address;
      }
      return undefined;
    }
    return undefined;
  }

  public extractReferralAddressWithoutDelimiter(data: string) {
    const referralData = this.subtractFunctionArgsFromCallData(data);
    if (referralData.length === 40) {
      try {
        return ethers.utils.getAddress(`0x${referralData}`);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  public cumputeReferralStats() {
    return this.dataSource.transaction("REPEATABLE READ", async (entityManager) => {
      this.logger.log(`start cumputeReferralStats()`);
      const t1 = performance.now();
      const window = -1;
      const deposits = await entityManager
        .createQueryBuilder(DepositsFilteredReferrals, "d")
        .select("d.stickyReferralAddress")
        .groupBy("d.stickyReferralAddress")
        .getMany();
      const referralAddresses = deposits.map((deposit) => deposit.stickyReferralAddress);
      this.logger.log(`window ${window}: ${referralAddresses.length} referralAddresses`);
      await Bluebird.Promise.map(
        referralAddresses,
        (address) => {
          return this.computeStatsForReferralAddress(entityManager, address);
        },
        { concurrency: 10 },
      );

      const t2 = performance.now();
      this.logger.log(`cumputeReferralStats() took ${(t2 - t1) / 1000} seconds`);
    });
  }

  public async extractReferralAddressOrComputeStickyReferralAddresses({
    blockTimestamp,
    deposit,
    transactionData,
  }: {
    deposit: Deposit;
    blockTimestamp: number;
    transactionData: string;
  }) {
    const referralAddress = await this.getReferralAddress({ blockTimestamp, transactionData });
    await this.depositRepository.update(
      { id: deposit.id },
      { referralAddress: referralAddress || null, stickyReferralAddress: referralAddress || null },
    );

    // If the tx data contains a referral address, then the consumer execution is done,
    // else look for a sticky referral address
    if (referralAddress) return { referralAddress, stickyReferralAddress: undefined };

    // Compute the sticky referral address
    const stickyReferralAddress = await this.getStickyReferralAddress(deposit);

    return { referralAddress: undefined, stickyReferralAddress };
  }

  public async getStickyReferralAddress(deposit: Deposit) {
    // Check if the depositor made a deposit in the past using a referral address
    const previousDepositWithReferralAddress = await this.depositRepository.findOne({
      where: {
        depositorAddr: deposit.depositorAddr,
        referralAddress: Not(IsNull()),
        depositDate: LessThanOrEqual(deposit.depositDate),
      },
      order: {
        depositDate: "DESC",
      },
    });
    await this.depositRepository.update(
      { id: deposit.id },
      { referralAddress: null, stickyReferralAddress: previousDepositWithReferralAddress?.referralAddress || null },
    );

    return previousDepositWithReferralAddress?.referralAddress;
  }

  private async getReferralAddress({
    blockTimestamp,
    transactionData,
  }: {
    blockTimestamp: number;
    transactionData: string;
  }) {
    const { referralDelimiterStartTimestamp } = this.appConfig.values.app;
    let referralAddress: string | undefined = undefined;

    if (referralDelimiterStartTimestamp && blockTimestamp >= referralDelimiterStartTimestamp) {
      referralAddress = this.extractReferralAddressUsingDelimiter(transactionData);
    } else {
      referralAddress = this.extractReferralAddressWithoutDelimiter(transactionData);

      if (referralAddress) {
        const nonce = await this.ethProvidersService.getProvider(ChainIds.mainnet).getTransactionCount(referralAddress);
        if (nonce === 0) referralAddress = undefined;
      }
    }

    return referralAddress;
  }

  private async computeStatsForReferralAddress(entityManager: EntityManager, referralAddress: string) {
    const claims = await entityManager
      .createQueryBuilder(Claim, "c")
      .where("c.account = :account", { account: referralAddress })
      .andWhere("c.windowIndex > 0")
      .orderBy("c.claimedAt", "ASC")
      .getMany();
    const deposits = await entityManager
      .createQueryBuilder(DepositsFilteredReferrals, "d")
      .andWhere("d.stickyReferralAddress = :referralAddress", { referralAddress })
      .getMany();
    const sortedDeposits = deposits.sort((d1, d2) => (d1.depositDate.getTime() < d2.depositDate.getTime() ? -1 : 0));
    const sortedClaims = claims.sort((c1, c2) => (c1.claimedAt.getTime() < c2.claimedAt.getTime() ? -1 : 0));
    const groupedDeposits = this.groupDepositsByClaimDate(sortedDeposits, sortedClaims);
    const depositsWithNoWindow = groupedDeposits["-1"] || [];
    await this.computeReferralStatsForDeposits(depositsWithNoWindow, entityManager);
  }

  private async computeReferralStatsForDeposits(deposits: DepositsFilteredReferrals[], entityManager: EntityManager) {
    const depositorAddrCounts = {};
    const depositCounts = {};
    const depositVolume = {};
    let totalVolume = new BigNumber(0);
    let currentCount = 0;

    for (const deposit of deposits) {
      const prevCount = depositorAddrCounts[deposit.depositorAddr];

      if (!prevCount) {
        depositCounts[deposit.id] = ++currentCount;
        depositorAddrCounts[deposit.depositorAddr] = currentCount;
      } else {
        depositCounts[deposit.id] = currentCount;
      }

      const volume = new BigNumber(deposit.amount)
        .multipliedBy(deposit.usd)
        .dividedBy(new BigNumber(10).pow(deposit.decimals));
      totalVolume = totalVolume.plus(volume);
      depositVolume[deposit.id] = totalVolume;
    }

    await Promise.all(
      splitArrayInChunks(deposits, 100).map((depositsChunk) => {
        const values: Partial<DepositReferralStat>[] = depositsChunk.map((d) => ({
          depositId: d.id,
          referralCount: depositCounts[d.id],
          referralVolume: depositVolume[d.id].toFixed(),
          referralClaimedWindowIndex: d.referralClaimedWindowIndex,
        }));
        return entityManager
          .createQueryBuilder(DepositReferralStat, "d")
          .insert()
          .values(values)
          .orUpdate({
            conflict_target: ["depositId"],
            overwrite: ["referralCount", "referralVolume", "referralClaimedWindowIndex"],
          })
          .execute();
      }),
    );
  }

  private groupDepositsByClaimDate(deposits: DepositsFilteredReferrals[], claims: Claim[]) {
    return deposits.reduce((acc, deposit) => {
      const claim = claims.filter((claim) => claim.claimedAt.getTime() >= deposit.depositDate.getTime())[0];
      const windowIndex = claim?.windowIndex || -1;
      return {
        ...acc,
        [windowIndex]: [...(acc[windowIndex] || []), deposit],
      };
    }, {} as Record<string, DepositsFilteredReferrals[]>);
  }
}
