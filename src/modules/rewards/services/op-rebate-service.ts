import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { DateTime } from "luxon";

import { Deposit } from "../../deposit/model/deposit.entity";
import { AppConfig } from "../../configuration/configuration.service";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { ChainIds } from "../../web3/model/ChainId";
import { MarketPriceService } from "../../market-price/services/service";
import { assertValidAddress, splitArrayInChunks } from "../../../utils";

import { OpReward } from "../model/op-reward.entity";
import { GetRewardsQuery } from "../entrypoints/http/dto";
import { WindowAlreadySetException } from "./exceptions";
import { ReferralRewardsWindowJobResult } from "../model/RewardsWindowJobResult.entity";

const OP_REBATE_RATE = 0.95;
const ELIGIBLE_OP_REWARDS_CHAIN_IDS = [ChainIds.base, ChainIds.mode, ChainIds.optimism];
@Injectable()
export class OpRebateService {
  private logger = new Logger(OpRebateService.name);

  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(OpReward) readonly rewardRepository: Repository<OpReward>,
    private marketPriceService: MarketPriceService,
    private ethProvidersService: EthProvidersService,
    private appConfig: AppConfig,
    private dataSource: DataSource,
  ) {}

  public async getEarnedRewards(userAddress: string) {
    userAddress = assertValidAddress(userAddress);

    const baseQuery = this.buildBaseQuery(this.rewardRepository.createQueryBuilder("r"), userAddress);
    const { opRewards } = await baseQuery
      .select("SUM(CAST(r.amount as DECIMAL))", "opRewards")
      .where("r.isClaimed = :isClaimed", { isClaimed: true })
      .getRawOne<{ opRewards: string }>();

    return opRewards;
  }

  public async getOpRebatesSummary(userAddress: string) {
    userAddress = assertValidAddress(userAddress);

    const baseQuery = this.buildBaseQuery(this.rewardRepository.createQueryBuilder("r"), userAddress);
    baseQuery.andWhere("r.isClaimed = :isClaimed", { isClaimed: false });
    const [{ depositsCount }, { unclaimedRewards }, { volumeUsd }] = await Promise.all([
      baseQuery.select("COUNT(DISTINCT r.depositPrimaryKey)", "depositsCount").getRawOne<{
        depositsCount: string;
      }>(),
      baseQuery.select("SUM(CAST(r.amount as DECIMAL))", "unclaimedRewards").getRawOne<{
        unclaimedRewards: number;
      }>(),
      baseQuery
        .leftJoinAndSelect("r.deposit", "d")
        .leftJoinAndSelect("d.token", "t")
        .leftJoinAndSelect("d.price", "p")
        .select(`COALESCE(SUM(d.amount / power(10, t.decimals) * p.usd), 0)`, "volumeUsd")
        .getRawOne<{
          volumeUsd: number;
        }>(),
      // TODO: add claimable rewards
    ]);

    return {
      depositsCount: parseInt(depositsCount),
      unclaimedRewards,
      volumeUsd,
      claimableRewards: "0",
    };
  }

  public async getOpRebateRewards(query: GetRewardsQuery) {
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");
    const userAddress = assertValidAddress(query.userAddress);

    const baseQuery = this.buildBaseQuery(this.rewardRepository.createQueryBuilder("r"), userAddress);

    const rewardsQuery = baseQuery.orderBy("r.depositDate", "DESC").limit(limit).offset(offset);
    const [rewards, total] = await rewardsQuery.getManyAndCount();

    const depositPrimaryKeys = rewards.map((reward) => reward.depositPrimaryKey);
    const deposits = await this.depositRepository.find({
      where: { id: In(depositPrimaryKeys) },
    });

    return {
      rewards: rewards.map((reward) => ({
        ...reward,
        deposit: deposits.find((deposit) => deposit.id === reward.depositPrimaryKey),
      })),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  public async getOpRebateRewardsForDepositPrimaryKeys(depositPrimaryKeys: number[]) {
    if (depositPrimaryKeys.length === 0) {
      return [];
    }
    const rewardsQuery = this.rewardRepository
      .createQueryBuilder("r")
      .where("r.depositPrimaryKey IN (:...depositPrimaryKeys)", { depositPrimaryKeys })
      .leftJoinAndSelect("r.rewardToken", "rewardToken");
    const rewards = await rewardsQuery.getMany();
    return rewards;
  }

  public async createOpRebatesForDeposit(depositPrimaryKey: number) {
    if (!this.appConfig.values.rewardPrograms["op-rebates"].enabled) {
      this.logger.verbose(`OP rebate rewards are disabled. Skipping...`);
      return;
    }

    const deposit = await this.depositRepository.findOne({
      where: { id: depositPrimaryKey },
      select: ["id", "status", "destinationChainId", "sourceChainId", "depositDate", "depositTxHash", "feeBreakdown"],
    });

    if (!deposit || deposit.status === "pending") return;
    if (!this.isDepositEligibleForOpRewards(deposit)) return;

    this.assertDepositKeys(deposit, ["depositDate", "feeBreakdown"]);

    if (!deposit.feeBreakdown.totalBridgeFeeUsd) {
      throw new Error(`Deposit with id ${depositPrimaryKey} is missing total bridge fee in USD`);
    }
    if (!this.isDepositTimeAfterStart(deposit)) return;
    if (!this.isDepositTimeBeforeEnd(deposit)) return;

    // We use the `from` address of the deposit transaction as the reward receiver
    // to also take into accounts deposits routed through the SpokePoolVerifier contract.
    const provider = this.ethProvidersService.getProvider(deposit.sourceChainId);
    const depositTransaction = await provider.getTransaction(deposit.depositTxHash);
    const rewardReceiver = depositTransaction.from;

    const { rewardToken, rewardsUsd, rewardsAmount } = await this.calcOpRebateRewards(deposit);

    let reward = await this.rewardRepository.findOne({
      where: {
        depositPrimaryKey: depositPrimaryKey,
        recipient: rewardReceiver,
      },
    });

    if (!reward) {
      reward = this.rewardRepository.create({
        depositPrimaryKey: depositPrimaryKey,
        recipient: rewardReceiver,
        depositDate: deposit.depositDate,
      });
    }

    await this.rewardRepository.save({
      ...reward,
      metadata: {
        rate: OP_REBATE_RATE,
      },
      amount: rewardsAmount.toString(),
      amountUsd: rewardsUsd,
      rewardTokenId: rewardToken.id,
    });
  }

  public setWindowForOpRewards(jobId: number, windowIndex: number, maxDepositDate: Date) {
    return this.dataSource.transaction(async (entityManager) => {
      const opRewardsWithSameWindowIndex = await entityManager
        .createQueryBuilder()
        .select("r")
        .from(OpReward, "r")
        .where("r.windowIndex = :windowIndex", { windowIndex })
        .getOne();

      if (opRewardsWithSameWindowIndex) {
        throw new WindowAlreadySetException();
      }

      await entityManager
        .createQueryBuilder()
        .update(OpReward)
        .set({ windowIndex })
        .where("windowIndex IS NULL")
        .andWhere("depositDate <= :maxDepositDate", { maxDepositDate })
        .execute();
      const rewards = await entityManager
        .createQueryBuilder()
        .select("r")
        .from(OpReward, "r")
        .where("r.windowIndex = :windowIndex", { windowIndex })
        .getMany();
      const { recipients, totalRewardsAmount } = this.aggregateOpRewards(rewards);

      for (const recipientsChunk of splitArrayInChunks(recipients, 100)) {
        await entityManager
          .createQueryBuilder()
          .insert()
          .into(ReferralRewardsWindowJobResult)
          .values(
            recipientsChunk.map((recipient) => ({
              jobId,
              windowIndex,
              totalRewardsAmount,
              address: recipient.account,
              amount: recipient.amount,
            })),
          )
          .execute();
      }
    });
  }

  public aggregateOpRewards(rewards: OpReward[]) {
    // Map an address to considered deposits for referral rewards
    const recipientOpRewardsMap = rewards.reduce((acc, r) => {
      acc[r.recipient] = [...(acc[r.recipient] || []), r];
      return acc;
    }, {} as Record<string, OpReward[]>);

    let totalRewardsAmount: BigNumber = new BigNumber(0);
    const recipients: {
      account: string;
      amount: string;
    }[] = [];

    for (const [address, opRewards] of Object.entries(recipientOpRewardsMap)) {
      const rewardsAmount = opRewards.reduce((sum, opReward) => {
        return sum.plus(opReward.amount);
      }, new BigNumber(0));

      totalRewardsAmount = totalRewardsAmount.plus(rewardsAmount);
      recipients.push({
        account: address,
        amount: rewardsAmount.toFixed(),
      });
    }

    return { totalRewardsAmount: totalRewardsAmount.toFixed(), recipients };
  }

  public isDepositEligibleForOpRewards(deposit: Pick<Deposit, "destinationChainId">) {
    return ELIGIBLE_OP_REWARDS_CHAIN_IDS.includes(deposit.destinationChainId);
  }

  /**
   * PRIVATE METHODS
   */

  private async calcOpRebateRewards(deposit: Deposit) {
    // lp fee + relayer capital fee + relayer destination gas fee
    const bridgeFeeUsd = deposit.feeBreakdown.totalBridgeFeeUsd;
    const rewardToken = await this.ethProvidersService.getCachedToken(
      this.appConfig.values.rewardPrograms["op-rebates"].rewardToken.chainId,
      this.appConfig.values.rewardPrograms["op-rebates"].rewardToken.address,
    );
    
    if (new BigNumber(bridgeFeeUsd).lte(0)) {
      return {
        rewardToken,
        rewardsUsd: "0",
        rewardsAmount: new BigNumber(0),
      };
    }

    const historicRewardTokenPrice = await this.marketPriceService.getCachedHistoricMarketPrice(
      DateTime.fromJSDate(deposit.depositDate).minus({ days: 1 }).toJSDate(),
      rewardToken.symbol.toLowerCase(),
    );
    const rewardsUsd = new BigNumber(bridgeFeeUsd).multipliedBy(OP_REBATE_RATE).toFixed();
    const positiveRewardsUsd = BigNumber.max(new BigNumber(0), rewardsUsd);
    const rewardsAmount = ethers.utils.parseEther(
      new BigNumber(positiveRewardsUsd).dividedBy(historicRewardTokenPrice.usd).toFixed(18),
    );

    return {
      rewardToken,
      rewardsUsd,
      rewardsAmount,
      historicRewardTokenPrice,
    };
  }

  private isDepositTimeAfterStart(deposit: Deposit) {
    const start = this.appConfig.values.rewardPrograms["op-rebates"].startDate;

    // If no start time is set, then the program is active for any deposit
    if (!start) {
      return true;
    }

    return deposit.depositDate >= start;
  }

  private isDepositTimeBeforeEnd(deposit: Deposit) {
    const end = this.appConfig.values.rewardPrograms["op-rebates"].endDate;

    // If no end time is set, then the program is active for any deposit
    if (!end) {
      return true;
    }

    return deposit.depositDate < end;
  }

  private assertDepositKeys(deposit: Deposit, requiredKeys: string[]) {
    for (const key of requiredKeys) {
      if (!deposit[key]) {
        throw new Error(`Deposit with id ${deposit.id} is missing '${key}'`);
      }
    }
  }

  private buildBaseQuery(qb: ReturnType<typeof this.rewardRepository.createQueryBuilder>, recipientAddress: string) {
    return qb.where("r.recipient = :recipient", { recipient: recipientAddress });
  }
}
