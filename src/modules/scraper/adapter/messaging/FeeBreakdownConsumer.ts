import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import BigNumber from "bignumber.js";

import { GasFeesService } from "../gas-fees/gas-fees-service";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { FeeBreakdownQueueMessage, OpRebateRewardMessage, ScraperQueue } from ".";
import { Deposit, DepositFillTx, DepositFillTx2 } from "../../../deposit/model/deposit.entity";
import { deriveRelayerFeeComponents, makePctValuesCalculator, toWeiPct } from "../../utils";

@Processor(ScraperQueue.FeeBreakdown)
export class FeeBreakdownConsumer {
  private logger = new Logger(FeeBreakdownConsumer.name);

  constructor(
    private gasFeesService: GasFeesService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<FeeBreakdownQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId }, relations: ["token", "price"] });

    if (!deposit) {
      this.logger.verbose("Deposit not found in db");
      return;
    }

    if (!deposit.token) {
      throw new Error("Token not populated");
    }

    if (!deposit.price) {
      throw new Error("Price not populated");
    }

    if (deposit.status !== "filled") {
      throw new Error("Deposit is not filled");
    }

    const fillTx = deposit.fillTxs.find((fillTx) => fillTx.totalFilledAmount === deposit.amount);

    if (!fillTx) {
      // Only consider fill txs that have been fully filled
      this.logger.verbose("Skip partial fill tx");
      return;
    }

    const feeBreakdown = await this.getFeeBreakdownForFillTx(
      fillTx,
      deposit.price.usd,
      deposit.token.decimals,
      deposit.destinationChainId,
    );
    deposit.feeBreakdown = feeBreakdown;
    await this.depositRepository.save(deposit);

    this.scraperQueuesService.publishMessage<OpRebateRewardMessage>(ScraperQueue.OpRebateReward, {
      depositPrimaryKey: deposit.id,
    });
  }

  private async getFeeBreakdownForFillTx(
    fillTx: DepositFillTx | DepositFillTx2,
    priceUsd: string,
    decimals: number,
    destinationChainId: number,
  ) {
    const calcPctValues = makePctValuesCalculator(fillTx.totalFilledAmount, priceUsd, decimals);
    const { feeUsd } = await this.gasFeesService.getFillTxNetworkFee(destinationChainId, fillTx.hash);

    const lpFeePctValues = calcPctValues(fillTx.realizedLpFeePct);
    const fillRelayerFeePct = (fillTx as DepositFillTx).appliedRelayerFeePct
      ? (fillTx as DepositFillTx).appliedRelayerFeePct
      : (fillTx as DepositFillTx2).relayerFeePct;
    const relayFeePctValues = calcPctValues(fillRelayerFeePct);
    const bridgeFeePctValues = calcPctValues(new BigNumber(fillTx.realizedLpFeePct).plus(fillRelayerFeePct).toString());

    const { gasFeeUsd, gasFeePct, capitalFeePct, capitalFeeUsd } = deriveRelayerFeeComponents(
      feeUsd,
      relayFeePctValues.pctAmountUsd,
      relayFeePctValues.pct,
    );

    return {
      lpFeeUsd: lpFeePctValues.pctAmountUsd,
      lpFeePct: toWeiPct(lpFeePctValues.pct),
      lpFeeAmount: lpFeePctValues.pctAmount,
      relayCapitalFeeUsd: capitalFeeUsd,
      relayCapitalFeePct: toWeiPct(capitalFeePct),
      relayCapitalFeeAmount: new BigNumber(fillTx.fillAmount).multipliedBy(capitalFeePct).toFixed(0),
      relayGasFeeUsd: gasFeeUsd,
      relayGasFeePct: toWeiPct(gasFeePct),
      relayGasFeeAmount: new BigNumber(fillTx.fillAmount).multipliedBy(gasFeePct).toFixed(0),
      totalBridgeFeeUsd: bridgeFeePctValues.pctAmountUsd,
      totalBridgeFeePct: toWeiPct(bridgeFeePctValues.pct),
      totalBridgeFeeAmount: bridgeFeePctValues.pctAmount,
    };
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.FeeBreakdown} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
