import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { DateTime } from "luxon";

import { Deposit } from "../../deposit/model/deposit.entity";
import { AppConfig } from "../../configuration/configuration.service";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { ChainIds } from "../../web3/model/ChainId";
import { MarketPriceService } from "../../market-price/services/service";

import { Reward } from "../model/reward.entity";

const OP_REBATE_RATE = 0.95;

@Injectable()
export class OpRebateService {
  private logger = new Logger(OpRebateService.name);

  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(Reward) readonly rewardRepository: Repository<Reward>,
    private marketPriceService: MarketPriceService,
    private ethProvidersService: EthProvidersService,
    private appConfig: AppConfig,
  ) {}

  public async createOpRebatesForDeposit(depositPrimaryKey: number) {
    if (!this.appConfig.values.rewardPrograms["op-rebates"].enabled) {
      this.logger.verbose(`OP rebate rewards are disabled. Skipping...`);
      return;
    }

    const deposit = await this.depositRepository.findOne({
      where: { id: depositPrimaryKey },
      relations: ["token", "price"],
    });

    if (!deposit || deposit.status === "pending") {
      this.logger.verbose(
        `Deposit with id ${depositPrimaryKey} ${!deposit ? "is not found" : "is pending"}. Skipping...`,
      );
      return;
    }

    if (deposit.destinationChainId !== ChainIds.optimism) {
      this.logger.verbose(`Deposit with id ${depositPrimaryKey} is not going to Optimism. Skipping...`);
      return;
    }

    this.assertDepositKeys(deposit, ["price", "token", "depositDate", "feeBreakdown"]);

    if (!this.isDepositTimeAfterStart(deposit)) {
      this.logger.verbose(`Deposit with id ${depositPrimaryKey} was made before the start of the program. Skipping...`);
      return;
    }

    if (!this.isDepositTimeBeforeEnd(deposit)) {
      this.logger.verbose(`Deposit with id ${depositPrimaryKey} was made after the end of the program. Skipping...`);
      return;
    }

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
        type: "op-rebates",
      },
    });

    if (!reward) {
      reward = this.rewardRepository.create({
        depositPrimaryKey: depositPrimaryKey,
        recipient: rewardReceiver,
        type: "op-rebates",
      });
    }

    await this.rewardRepository.save({
      ...reward,
      metadata: {
        type: "op-rebates",
        rate: OP_REBATE_RATE,
      },
      amount: rewardsAmount.toString(),
      amountUsd: rewardsUsd,
      rewardTokenId: rewardToken.id,
    });
  }

  private async calcOpRebateRewards(deposit: Deposit) {
    // lp fee + relayer capital fee + relayer destination gas fee
    const bridgeFeeUsd = deposit.feeBreakdown.totalBridgeFeeUsd;

    const rewardToken = await this.ethProvidersService.getCachedToken(
      this.appConfig.values.rewardPrograms["op-rebates"].rewardToken.chainId,
      this.appConfig.values.rewardPrograms["op-rebates"].rewardToken.address,
    );
    const historicRewardTokenPrice = await this.marketPriceService.getCachedHistoricMarketPrice(
      DateTime.fromJSDate(deposit.depositDate).minus({ days: 1 }).toJSDate(),
      rewardToken.symbol.toLowerCase(),
    );
    const rewardsUsd = new BigNumber(bridgeFeeUsd).multipliedBy(OP_REBATE_RATE).toFixed();
    const rewardsAmount = ethers.utils.parseEther(
      new BigNumber(rewardsUsd).dividedBy(historicRewardTokenPrice.usd).toFixed(),
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
}
