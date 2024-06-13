import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { DateTime } from "luxon";

import { Deposit } from "../../deposit/model/deposit.entity";
import { AppConfig } from "../../configuration/configuration.service";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { ChainIds } from "../../web3/model/ChainId";
import { MarketPriceService } from "../../market-price/services/service";

import { ArbReward } from "../model/arb-reward.entity";

const ARB_REBATE_RATE = 0.95;

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
    if (deposit.destinationChainId !== ChainIds.arbitrum) return;
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
}