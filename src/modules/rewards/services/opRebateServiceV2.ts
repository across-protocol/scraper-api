import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { DateTime } from "luxon";

import { RewardedDeposit } from "../model/RewardedDeposit.entity";
import { AppConfig } from "../../configuration/configuration.service";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { ChainIds } from "../../web3/model/ChainId";
import { MarketPriceService } from "../../market-price/services/service";
import { assertValidAddress, splitArrayInChunks } from "../../../utils";

import { OpRewardV2 } from "../model/OpRewardV2.entity";
// import { GetRewardsQuery } from "../entrypoints/http/dto";
import { WindowAlreadySetException } from "./exceptions";
import { ReferralRewardsWindowJobResult } from "../model/RewardsWindowJobResult.entity";
import { Token } from "src/modules/web3/model/token.entity";

const OP_REBATE_RATE = 0.95;
const REWARDS_PERCENTAGE_LIMIT = 0.0025; // 25 bps
export const ELIGIBLE_OP_REWARDS_CHAIN_IDS = [
  ChainIds.base,
  ChainIds.ink,
  ChainIds.lisk,
  ChainIds.mode,
  ChainIds.optimism,
  ChainIds.redstone,
  ChainIds.worldChain,
  ChainIds.zora,
];

@Injectable()
export class OpRebateServiceV2 {
  private logger = new Logger(OpRebateServiceV2.name);

  constructor(
    @InjectRepository(RewardedDeposit) readonly depositRepository: Repository<RewardedDeposit>,
    @InjectRepository(OpRewardV2) readonly rewardRepository: Repository<OpRewardV2>,
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

  // public async getOpRebateRewards(query: GetRewardsQuery) {
  //   const limit = parseInt(query.limit ?? "10");
  //   const offset = parseInt(query.offset ?? "0");
  //   const userAddress = assertValidAddress(query.userAddress);

  //   const baseQuery = this.buildBaseQuery(this.rewardRepository.createQueryBuilder("r"), userAddress);

  //   const rewardsQuery = baseQuery.orderBy("r.depositDate", "DESC").limit(limit).offset(offset);
  //   const [rewards, total] = await rewardsQuery.getManyAndCount();
     
  //   // JOIN instead of query deposits separately 
  //   const depositPrimaryKeys = rewards.map((reward) => reward.depositPrimaryKey);
  //   const deposits = await this.depositRepository.find({
  //     where: { id: In(depositPrimaryKeys) },
  //   });

  //   return {
  //     rewards: rewards.map((reward) => ({
  //       ...reward,
  //       deposit: deposits.find((deposit) => deposit.id === reward.depositPrimaryKey),
  //     })),
  //     pagination: {
  //       limit,
  //       offset,
  //       total,
  //     },
  //   };
  // }

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

  public async createOpRebatesForDeposit(depositId: number, originChainId: number) {
    if (!this.appConfig.values.rewardPrograms["op-rebates"].enabled) {
      this.logger.verbose(`OP rebate rewards are disabled. Skipping...`);
      return;
    }

    const deposit: RewardedDeposit = await this.depositRepository.findOne({
      where: { depositId, originChainId },
    });

    if (!deposit || !deposit.fillTxHash) return;
    if (!this.isDepositEligibleForOpRewards(deposit)) return;
    if (!deposit.totalBridgeFeeUsd) {
      throw new Error(`Missing total bridge fee in USD (depositId: ${depositId}, originChainId: ${originChainId}).`);
    }
    if (!this.isDepositTimeAfterStart(deposit)) return;
    if (!this.isDepositTimeBeforeEnd(deposit)) return;

    // We use the `from` address of the deposit transaction as the reward receiver
    // to also take into accounts deposits routed through the SpokePoolVerifier contract.
    const provider = this.ethProvidersService.getProvider(deposit.originChainId);
    const depositTransaction = await provider.getTransaction(deposit.depositTxHash); // This could also be part of the indexer data
    const rewardReceiver = depositTransaction.from;

    const { rewardToken, rewardsUsd, rewardsAmount } = await this.calcOpRebateRewards(deposit);

    let reward = await this.rewardRepository.findOne({
      where: {
        depositId, originChainId,
        recipient: rewardReceiver,
      },
    });

    if (!reward) {
      reward = this.rewardRepository.create({
        depositId, originChainId,
        recipient: rewardReceiver,
        depositDate: deposit.depositDate,
      });
    }

    await this.rewardRepository.save({
      ...reward,
      rate: OP_REBATE_RATE.toString(),
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
        .from(OpRewardV2, "r")
        .where("r.windowIndex = :windowIndex", { windowIndex })
        .getOne();

      if (opRewardsWithSameWindowIndex) {
        throw new WindowAlreadySetException();
      }

      await entityManager
        .createQueryBuilder()
        .update(OpRewardV2)
        .set({ windowIndex })
        .where("windowIndex IS NULL")
        .andWhere("depositDate <= :maxDepositDate", { maxDepositDate })
        .execute();
      const rewards = await entityManager
        .createQueryBuilder()
        .select("r")
        .from(OpRewardV2, "r")
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

  public aggregateOpRewards(rewards: OpRewardV2[]) {
    // Map an address to considered deposits for referral rewards
    const recipientOpRewardsMap = rewards.reduce((acc, r) => {
      acc[r.recipient] = [...(acc[r.recipient] || []), r];
      return acc;
    }, {} as Record<string, OpRewardV2[]>);

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

  public isDepositEligibleForOpRewards(deposit: Pick<RewardedDeposit, "destinationChainId">) {
    return ELIGIBLE_OP_REWARDS_CHAIN_IDS.includes(deposit.destinationChainId);
  }

  /**
   * PRIVATE METHODS
   */

  private async calcOpRebateRewards(deposit: RewardedDeposit) {
    // lp fee + relayer capital fee + relayer destination gas fee
    const bridgeFeeUsd = new BigNumber(deposit.totalBridgeFeeUsd);
    const rewardToken = await this.ethProvidersService.getCachedToken(
      this.appConfig.values.rewardPrograms["op-rebates"].rewardToken.chainId,
      this.appConfig.values.rewardPrograms["op-rebates"].rewardToken.address,
    );

    if (bridgeFeeUsd.lte(0)) {
      return {
        rewardToken,
        rewardsUsd: "0",
        rewardsAmount: new BigNumber(0),
      };
    }

    const inputToken = await this.ethProvidersService.getCachedToken(deposit.originChainId, deposit.inputToken);
    const outputToken = await this.ethProvidersService.getCachedToken(deposit.originChainId, deposit.outputToken);
    
    const inputTokenPrice = await this.getInputTokenPrice(deposit, inputToken, outputToken); // This could also be part of the indexer data
    const historicRewardTokenPrice = await this.getTokenPrice(deposit.depositDate, rewardToken);

    const inputAmountUsd = new BigNumber(deposit.inputAmount)
      .multipliedBy(inputTokenPrice)
      .dividedBy(new BigNumber(10).pow(inputToken.decimals));
    const cappedFeeForRewardsUsd = inputAmountUsd.multipliedBy(REWARDS_PERCENTAGE_LIMIT);
    const rewardsUsd = BigNumber.min(bridgeFeeUsd, cappedFeeForRewardsUsd).multipliedBy(OP_REBATE_RATE).toFixed();
    const rewardsAmount = ethers.utils.parseEther(
      new BigNumber(rewardsUsd).dividedBy(historicRewardTokenPrice.usd).toFixed(18),
    );

    return {
      rewardToken,
      rewardsUsd,
      rewardsAmount,
      historicRewardTokenPrice,
    };
  }

  private isDepositTimeAfterStart(deposit: RewardedDeposit) {
    const start = this.appConfig.values.rewardPrograms["op-rebates"].startDate;

    // If no start time is set, then the program is active for any deposit
    if (!start) {
      return true;
    }

    return deposit.depositDate >= start;
  }

  private isDepositTimeBeforeEnd(deposit: RewardedDeposit) {
    const end = this.appConfig.values.rewardPrograms["op-rebates"].endDate;

    // If no end time is set, then the program is active for any deposit
    if (!end) {
      return true;
    }

    return deposit.depositDate < end;
  }

  private async getInputTokenPrice(deposit: RewardedDeposit, inputToken: Token, outputToken: Token): Promise<string> {
    if (
      deposit.originChainId === ChainIds.blast &&
      inputToken.symbol === "USDB" &&
      outputToken.symbol === "DAI"
    ) {
      const outputTokenPrice = await this.getTokenPrice(deposit.depositDate, outputToken);
       return outputTokenPrice.usd;
    }
    const inputTokenPrice = await this.getTokenPrice(deposit.depositDate, inputToken);
    return inputTokenPrice.usd;
  }

  private async getTokenPrice(depositDate: Date, token: Token){
    return await this.marketPriceService.getCachedHistoricMarketPrice(
      DateTime.fromJSDate(depositDate).minus({ days: 1 }).toJSDate(),
      token.symbol.toLowerCase());
  }

  private buildBaseQuery(qb: ReturnType<typeof this.rewardRepository.createQueryBuilder>, recipientAddress: string) {
    return qb.where("r.recipient = :recipient", { recipient: recipientAddress });
  }
}
