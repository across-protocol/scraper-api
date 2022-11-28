import { CACHE_MANAGER, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { performance } from "perf_hooks";
import Bluebird from "bluebird";
import { ethers } from "ethers";
import { Cache } from "cache-manager";

import { Deposit } from "../../scraper/model/deposit.entity";
import {
  getActiveRefereesCountQuery,
  getReferralsQuery,
  getReferralsTotalQuery,
  getReferralTransfersQuery,
  getReferralVolumeQuery,
  getReferreeWalletsQuery,
  getTotalReferralRewardsQuery,
  getRefreshMaterializedView,
} from "./queries";
import { AppConfig } from "../../configuration/configuration.service";
import { DepositsMv } from "../../deposit/model/DepositsMv.entity";
import { WindowAlreadySetException } from "./exceptions";
import { DepositsFilteredReferrals } from "../model/DepositsFilteredReferrals.entity";
import { DepositReferralStat } from "../../deposit/model/deposit-referral-stat.entity";
import { splitArrayInChunks } from "../../../utils";

const REFERRAL_ADDRESS_DELIMITER = "d00dfeeddeadbeef";
const getReferralsSummaryCacheKey = (address: string) => `referrals:summary:${address}`;

@Injectable()
export class ReferralService {
  private logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(DepositsMv) private depositsMvRepository: Repository<DepositsMv>,
    private appConfig: AppConfig,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  public async getReferralSummary(address: string) {
    let data = await this.cacheManager.get(getReferralsSummaryCacheKey(address));

    if (data) return data;

    const referreeWalletsQuery = getReferreeWalletsQuery();
    const referralTransfersQuery = getReferralTransfersQuery();
    const referralVolumeQuery = getReferralVolumeQuery();
    const totalReferralRewardsQuery = getTotalReferralRewardsQuery();
    const activeRefereesCountQuery = getActiveRefereesCountQuery();
    const [
      referreeWalletsResult,
      transfersResult,
      volumeResult,
      totalReferralRewardsResult,
      activeRefereesCountResult,
    ] = await Promise.all([
      this.depositRepository.query(referreeWalletsQuery, [address]),
      this.depositRepository.query(referralTransfersQuery, [address]),
      this.depositRepository.query(referralVolumeQuery, [address]),
      this.depositRepository.query(totalReferralRewardsQuery, [address, this.appConfig.values.acxUsdPrice]),
      this.depositRepository.query(activeRefereesCountQuery, [address]),
    ]);

    const rewardsAmount = totalReferralRewardsResult[0]?.acxRewards || "0";
    const transfers = parseInt(transfersResult[0].count);
    const referreeWallets = parseInt(referreeWalletsResult[0].count);
    const volume = volumeResult[0].volume || 0;
    const { referralRate, tier } = this.getTierLevelAndBonus(referreeWallets, volume);
    const activeRefereesCount = parseInt(activeRefereesCountResult[0].count);

    data = {
      referreeWallets,
      transfers,
      volume,
      referralRate,
      rewardsAmount,
      tier,
      activeRefereesCount,
    };
    await this.cacheManager.set(getReferralsSummaryCacheKey(address), data, 120);

    return data;
  }

  public async getReferrals(address: string, limit = 10, offset = 0) {
    const query = getReferralsQuery();
    const totalQuery = getReferralsTotalQuery();
    const [result, totalResult] = await Promise.all([
      this.depositRepository.manager.query(query, [address, this.appConfig.values.acxUsdPrice, limit, offset]),
      this.depositRepository.query(totalQuery, [address]),
    ]);
    const total = parseInt(totalResult[0].count);

    return {
      referrals: result.map((item) => ({ ...item, acxRewards: item.acxRewards })),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  public async createReferralsMerkleDistribution(windowIndex: number, maxDepositDate: Date) {
    return this.dataSource.transaction("REPEATABLE READ", async (entityManager) => {
      const depositWithSameWindowIndex = await entityManager
        .createQueryBuilder(Deposit, "d")
        .where("d.rewardsWindowIndex = :windowIndex", { windowIndex })
        .getOne();

      if (Boolean(depositWithSameWindowIndex)) {
        throw new WindowAlreadySetException();
      }

      const deposits = await entityManager
        .createQueryBuilder(DepositsMv, "deposit")
        .where("deposit.rewardsWindowIndex IS NULL")
        .andWhere("deposit.depositDate <= :maxDepositDate", { maxDepositDate })
        .getMany();
      console.log(`found ${deposits.length} deposits`);
      const { recipients, rewardsToDeposit } = this.calculateReferralRewards(deposits);

      for (const depositsChunk of splitArrayInChunks(deposits, 100)) {
        await this.dataSource
          .createQueryBuilder()
          .update(Deposit)
          .set({ rewardsWindowIndex: windowIndex })
          .where({ id: In(depositsChunk.map((d) => d.id)) })
          .execute();
      }

      return {
        chainId: this.appConfig.values.web3.merkleDistributor.chainId,
        rewardToken: this.appConfig.values.web3.acx.address,
        windowIndex,
        rewardsToDeposit,
        recipients,
      };
    });
  }

  public async revertReferralsMerkleDistribution(windowIndex: number) {
    await this.depositRepository.update({ rewardsWindowIndex: windowIndex }, { rewardsWindowIndex: null });
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

  public subtractFunctionArgsFromCallData(data: string) {
    const coder = new ethers.utils.AbiCoder();
    // strip hex method identifier
    const dataNoMethod = ethers.utils.hexDataSlice(data, 4);
    // keep method hex identifier
    const methodHex = data.replace(dataNoMethod.replace("0x", ""), "");
    const decodedData = coder.decode(
      ["address", "address", "uint256", "uint256", "uint64", "uint32"],
      ethers.utils.hexDataSlice(data, 4),
    );
    const encoded = coder.encode(["address", "address", "uint256", "uint256", "uint64", "uint32"], decodedData);
    const fullEncoded = methodHex + encoded.replace("0x", "");
    return data.replace(fullEncoded, "");
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

  public extractReferralAddress(data: string) {
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

  public refreshMaterializedView() {
    return this.depositRepository.query(getRefreshMaterializedView());
  }

  public calculateReferralRewards(deposits: DepositsMv[]) {
    // Map an address to considered deposits for referral rewards
    const addressToDepositsMap = deposits.reduce((acc: Record<string, DepositsMv[]>, d) => {
      if (d.referralAddress) {
        acc[d.referralAddress] = [...(acc[d.referralAddress] || []), d];
        if (d.depositorAddr !== d.referralAddress) {
          acc[d.depositorAddr] = [...(acc[d.depositorAddr] || []), d];
        }
      }
      return acc;
    }, {});

    let rewardsToDeposit: BigNumber = new BigNumber(0);
    const recipients: {
      account: string;
      amount: string;
      metadata: {
        amountBreakdown: {
          referralRewards: string;
        };
      };
    }[] = [];

    for (const [address, deposits] of Object.entries(addressToDepositsMap)) {
      const acxRewards = deposits.reduce((sum, d) => {
        const feePct =
          d.depositorAddr === address && d.referralAddress === address ? 1 : d.depositorAddr === address ? 0.25 : 0.75;
        const rewards = new BigNumber(d.bridgeFeeUsd)
          .multipliedBy(d.referralRate)
          .multipliedBy(feePct)
          .multipliedBy(d.multiplier)
          .multipliedBy(new BigNumber(10).pow(18))
          .dividedBy(this.appConfig.values.acxUsdPrice)
          .toFixed(0);
        return sum.plus(rewards);
      }, new BigNumber(0));

      rewardsToDeposit = rewardsToDeposit.plus(acxRewards);
      recipients.push({
        account: address,
        amount: acxRewards.toFixed(),
        metadata: {
          amountBreakdown: {
            referralRewards: acxRewards.toFixed(),
          },
        },
      });
    }

    return { rewardsToDeposit: rewardsToDeposit.toFixed(), recipients };
  }

  public cumputeReferralStats() {
    return this.dataSource.transaction("REPEATABLE READ", async (entityManager) => {
      this.logger.log(`start cumputeReferralStats()`);
      const t1 = performance.now();
      const window = -1;

      const deposits = await entityManager
        .createQueryBuilder(DepositsFilteredReferrals, "d")
        .select("d.stickyReferralAddress")
        .where("d.claimedWindowIndex = :claimedWindowIndex", { claimedWindowIndex: window })
        .groupBy("d.stickyReferralAddress")
        .getMany();
      const referralAddresses = deposits.map((deposit) => deposit.stickyReferralAddress);
      this.logger.log(`window ${window}: ${referralAddresses.length} referralAddresses`);
      await Bluebird.Promise.map(
        referralAddresses,
        (address) => {
          return this.computeStatsForReferralAddress(entityManager, window, address);
        },
        { concurrency: 10 },
      );

      const t2 = performance.now();
      this.logger.log(`cumputeReferralStats() took ${(t2 - t1) / 1000} seconds`);
    });
  }

  private async computeStatsForReferralAddress(entityManager: EntityManager, window: number, referralAddress: string) {
    const depositsResult = await entityManager
      .createQueryBuilder(DepositsFilteredReferrals, "d")
      .where("d.claimedWindowIndex = :claimedWindowIndex", { claimedWindowIndex: window })
      .andWhere("d.stickyReferralAddress = :referralAddress", { referralAddress })
      .getMany();
    const depositorAddrCounts = {};
    const depositCounts = {};
    const depositVolume = {};
    let totalVolume = new BigNumber(0);

    let currentCount = 0;
    const sortedDeposits = depositsResult.sort((d1, d2) => (d1.depositDate < d2.depositDate ? -1 : 0));

    for (const deposit of sortedDeposits) {
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

    for (const depositsChunk of splitArrayInChunks(sortedDeposits, 100)) {
      const values = depositsChunk.map((d) => ({
        depositId: d.id,
        referralCount: depositCounts[d.id],
        referralVolume: depositVolume[d.id].toFixed(),
      }));
      await entityManager
        .createQueryBuilder(DepositReferralStat, "d")
        .insert()
        .values(values)
        .orUpdate({ conflict_target: ["depositId"], overwrite: ["referralCount", "referralVolume"] })
        .execute();
    }
  }
}
