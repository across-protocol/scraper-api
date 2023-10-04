import { CACHE_MANAGER, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { performance } from "perf_hooks";
import Bluebird from "bluebird";
import { ethers } from "ethers";
import { Cache } from "cache-manager";

import { Deposit } from "../../deposit/model/deposit.entity";
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
import { Claim } from "../../airdrop/model/claim.entity";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { ChainIds } from "../../web3/model/ChainId";
import { StickyReferralAddressesMechanism } from "../../configuration";
import { Transaction } from "../../web3/model/transaction.entity";

const REFERRAL_ADDRESS_DELIMITER = "d00dfeeddeadbeef";
const getReferralsSummaryCacheKey = (address: string) => `referrals:summary:${address}`;

@Injectable()
export class ReferralService {
  private logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(DepositsMv) readonly depositsMvRepository: Repository<DepositsMv>,
    private ethProvidersService: EthProvidersService,
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
      this.depositRepository.query(totalReferralRewardsQuery, [address]),
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

    if (this.appConfig.values.app.cacheDuration.referralsSummary) {
      await this.cacheManager.set(
        getReferralsSummaryCacheKey(address),
        data,
        this.appConfig.values.app.cacheDuration.referralsSummary,
      );
    }

    return data;
  }

  public async getReferrals(address: string, limit = 10, offset = 0) {
    const query = getReferralsQuery();
    const totalQuery = getReferralsTotalQuery();
    const [result, totalResult] = await Promise.all([
      this.depositRepository.manager.query(query, [address, limit, offset]),
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
          .dividedBy(d.acxUsdPrice)
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

  public async extractReferralAddressAndComputeStickyReferralAddresses(depositId: number) {
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });

    if (!deposit) return;
    // if depositDate field is missing, throw an error to retry the message as this field is necessary to compute
    // the sticky referral address.
    if (!deposit.depositDate) throw new Error(`depositId ${deposit.id}: wait for depositDate`);

    const { depositTxHash, sourceChainId } = deposit;
    const transaction = await this.ethProvidersService.getCachedTransaction(sourceChainId, depositTxHash);
    const block = await this.ethProvidersService.getCachedBlock(sourceChainId, transaction.blockNumber);
    const blockTimestamp = parseInt((new Date(block.date).getTime() / 1000).toFixed(0));

    if (!transaction) throw new Error("Transaction not found");

    const referralAddress = await this.extractReferralAddress({ blockTimestamp, depositId, transaction });
    this.logger.debug(
      `depositId ${depositId}: update referralAddress and stickyReferralAddress with ${referralAddress}`,
    );
    await this.depositRepository.update(
      { id: deposit.id },
      { referralAddress: referralAddress || null, stickyReferralAddress: referralAddress || null },
    );

    // If the tx data contain a referral address, then the consumer execution is done.
    if (referralAddress) return;

    // if the computation of sticky referral address is configured to be made using a different mechanism or
    // it is disabled, then stop the execution of the consumer
    if (this.appConfig.values.stickyReferralAddressesMechanism !== StickyReferralAddressesMechanism.Queue) {
      return;
    }

    // Compute the sticky referral address for depositor's deposits that don't have a referral address
    // in the tx calldata and made after this deposit
    await this.computeStickyReferralAddress(deposit);
    this.logger.debug(`depositId ${depositId}: done`);
  }

  public async computeStickyReferralAddress(deposit: Deposit) {
    // Check if the depositor made a deposit in the past using a referral address
    const previousDepositWithReferralAddress = await this.depositRepository.findOne({
      where: {
        depositorAddr: deposit.depositorAddr,
        referralAddress: Not(IsNull()),
        depositDate: LessThanOrEqual(deposit.depositDate),
      },
    });
    this.logger.debug(
      `depositId ${deposit.id}: previousDepositWithReferralAddress ${!!previousDepositWithReferralAddress}`,
    );

    // If the depositor didn't make a deposit in the past using a referral address, then there is no need to
    // compute the sticky referral address and the consumer execution is stopped
    if (!previousDepositWithReferralAddress) return;

    let page = 0;
    const limit = 1000;

    while (true) {
      // Make paginated SQL queries to get all deposits without a referral address and made after the processed deposit
      this.logger.debug(`computeStickyReferralAddress: request page ${page} depositorAddr ${deposit.depositorAddr}`);
      const deposits = await this.depositRepository.find({
        where: {
          depositorAddr: deposit.depositorAddr,
          referralAddress: IsNull(),
          depositDate: MoreThanOrEqual(deposit.depositDate),
        },
        take: limit,
        skip: page * limit,
      });
      this.logger.debug(`computeStickyReferralAddress: fetched page ${page} depositorAddr ${deposit.depositorAddr}`);

      for (const d of deposits) {
        // for each deposit d with no referral address, find the last previous deposit with a referral address and set it
        // as the sticky referral address of deposit d
        this.logger.debug(`computeStickyReferralAddress: request previousDepositWithReferralAddress`);
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
        this.logger.debug(`computeStickyReferralAddress: fetched previousDepositWithReferralAddress`);
        await this.depositRepository.update(
          { id: d.id },
          { stickyReferralAddress: previousDepositWithReferralAddress.referralAddress },
        );
      }

      // if the length of the returned deposits is lower than the limit, we processed all depositor's deposits,
      // else go to the next page
      if (deposits.length < limit) {
        break;
      } else {
        page = page + 1;
      }
    }
  }

  private async extractReferralAddress({
    blockTimestamp,
    depositId,
    transaction,
  }: {
    blockTimestamp: number;
    depositId: number;
    transaction: Transaction;
  }) {
    const { referralDelimiterStartTimestamp } = this.appConfig.values.app;
    let referralAddress: string | undefined = undefined;

    if (referralDelimiterStartTimestamp && blockTimestamp >= referralDelimiterStartTimestamp) {
      this.logger.debug(`depositId ${depositId}: extractReferralAddressUsingDelimiter`);
      referralAddress = this.extractReferralAddressUsingDelimiter(transaction.data);
    } else {
      this.logger.debug(`depositId ${depositId}: extractReferralAddress`);
      referralAddress = this.extractReferralAddressWithoutDelimiter(transaction.data);

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

    for (const deposits of Object.values(groupedDeposits)) {
      await this.computeReferralStatsForDeposits(deposits, entityManager);
    }
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
