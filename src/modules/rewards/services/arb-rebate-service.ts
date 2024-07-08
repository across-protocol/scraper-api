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
import { assertValidAddress } from "../../../utils";

import { ArbReward } from "../model/arb-reward.entity";
import { GetRewardsQuery } from "../entrypoints/http/dto";

const ARB_REBATE_RATE = 0.95;
const ELIGIBLE_ARB_REWARDS_CHAIN_IDS = [ChainIds.arbitrum];

type PartialDeposit = Pick<
  Deposit,
  "id" | "status" | "destinationChainId" | "depositDate" | "feeBreakdown" | "sourceChainId" | "depositTxHash"
>;
const partialDepositKeys: (keyof Deposit)[] = [
  "id",
  "status",
  "destinationChainId",
  "depositDate",
  "feeBreakdown",
  "sourceChainId",
  "depositTxHash",
];

@Injectable()
export class ArbRebateService {
  private logger = new Logger(ArbRebateService.name);

  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(ArbReward) readonly arbRewardRepository: Repository<ArbReward>,
    private marketPriceService: MarketPriceService,
    private ethProvidersService: EthProvidersService,
    private appConfig: AppConfig,
    private dataSource: DataSource,
  ) {}

  public async getEarnedRewards(userAddress: string) {
    userAddress = assertValidAddress(userAddress);

    const baseQuery = this.buildBaseQuery(this.arbRewardRepository.createQueryBuilder("r"), userAddress);
    const { arbRewards } = await baseQuery
      .select("SUM(CAST(r.amount as DECIMAL))", "arbRewards")
      .where("r.isClaimed = :isClaimed", { isClaimed: true })
      .getRawOne<{ arbRewards: string }>();

    return arbRewards;
  }

  public async getArbRebatesSummary(userAddress: string) {
    userAddress = assertValidAddress(userAddress);

    const baseQuery = this.buildBaseQuery(this.arbRewardRepository.createQueryBuilder("r"), userAddress);
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
    ]);

    return {
      depositsCount: parseInt(depositsCount),
      unclaimedRewards,
      volumeUsd,
      claimableRewards: "0",
    };
  }

  public async getArbRebateRewards(query: GetRewardsQuery) {
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");
    const userAddress = assertValidAddress(query.userAddress);

    const baseQuery = this.buildBaseQuery(this.arbRewardRepository.createQueryBuilder("r"), userAddress);

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

  public async getArbRebateRewardsForDepositPrimaryKeys(depositPrimaryKeys: number[]) {
    if (depositPrimaryKeys.length === 0) {
      return [];
    }
    const rewardsQuery = this.arbRewardRepository
      .createQueryBuilder("r")
      .where("r.depositPrimaryKey IN (:...depositPrimaryKeys)", { depositPrimaryKeys });
    const rewards = await rewardsQuery.getMany();
    return rewards;
  }

  public async createArbRebatesForDeposit(depositPrimaryKey: number) {
    if (!this.appConfig.values.rewardPrograms.arbRebates.enabled) {
      this.logger.verbose(`ARB rebate rewards are disabled. Skipping...`);
      return;
    }

    const deposit: PartialDeposit = await this.depositRepository.findOne({
      where: { id: depositPrimaryKey },
      select: partialDepositKeys,
    });

    if (!deposit || deposit.status === "pending") return;
    if (!this.isDepositEligibleForArbRewards(deposit)) return;
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
    const { rewardToken, rewardsUsd, rewardsAmount } = await this.calcArbRebateRewards(deposit);

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(ArbReward)
      .values({
        depositPrimaryKey: depositPrimaryKey,
        recipient: rewardReceiver,
        depositDate: deposit.depositDate,
        metadata: {
          rate: ARB_REBATE_RATE,
        },
        amount: rewardsAmount.toString(),
        amountUsd: rewardsUsd,
        rewardTokenId: rewardToken.id,
      })
      .orUpdate(["recipient", "depositDate", "metadata", "amount", "amountUsd", "rewardTokenId"], ["depositPrimaryKey"])
      .execute();
  }

  public isDepositEligibleForArbRewards(deposit: Pick<Deposit, "destinationChainId">) {
    return ELIGIBLE_ARB_REWARDS_CHAIN_IDS.includes(deposit.destinationChainId);
  }

  private async calcArbRebateRewards(deposit: PartialDeposit) {
    const bridgeFeeUsd = deposit.feeBreakdown.totalBridgeFeeUsd;
    const rewardToken = await this.ethProvidersService.getCachedToken(
      this.appConfig.values.rewardPrograms.arbRebates.rewardToken.chainId,
      this.appConfig.values.rewardPrograms.arbRebates.rewardToken.address,
    );
    const historicRewardTokenPrice = await this.marketPriceService.getCachedHistoricMarketPrice(
      DateTime.fromJSDate(deposit.depositDate).minus({ days: 1 }).toJSDate(),
      rewardToken.symbol.toLowerCase(),
    );
    const rewardsUsd = new BigNumber(bridgeFeeUsd).multipliedBy(ARB_REBATE_RATE).toFixed();
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

  private isDepositTimeAfterStart(deposit: PartialDeposit) {
    const start = this.appConfig.values.rewardPrograms.arbRebates.startDate;

    // If no start time is set, then the program is active for any deposit
    if (!start) {
      return true;
    }

    return deposit.depositDate >= start;
  }

  private isDepositTimeBeforeEnd(deposit: PartialDeposit) {
    const end = this.appConfig.values.rewardPrograms.arbRebates.endDate;

    // If no end time is set, then the program is active for any deposit
    if (!end) {
      return true;
    }

    return deposit.depositDate < end;
  }

  private assertDepositKeys(deposit: PartialDeposit, requiredKeys: string[]) {
    for (const key of requiredKeys) {
      if (!deposit[key]) {
        throw new Error(`Deposit with id ${deposit.id} is missing '${key}'`);
      }
    }
  }

  private buildBaseQuery(qb: ReturnType<typeof this.arbRewardRepository.createQueryBuilder>, recipientAddress: string) {
    return qb.where("r.recipient = :recipient", { recipient: recipientAddress });
  }
}
