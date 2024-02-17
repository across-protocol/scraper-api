import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import BigNumber from "bignumber.js";

import { GasFeesService } from "../gas-fees/gas-fees-service";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { FeeBreakdownQueueMessage, OpRebateRewardMessage, ScraperQueue } from ".";
import { Deposit, DepositFillTx, DepositFillTx2, DepositFillTxV3 } from "../../../deposit/model/deposit.entity";
import { deriveRelayerFeeComponents, makePctValuesCalculator, toWeiPct } from "../../utils";
import { AcrossContractsVersion } from "src/modules/web3/model/across-version";

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
    const deposit = await this.depositRepository.findOne({
      where: { id: depositId },
      relations: ["token", "price", "outputToken", "outputTokenPrice"],
    });

    if (!deposit) return;
    if (deposit.status !== "filled") return;
    if (deposit.fillTxs.length === 0) return;

    if (!deposit.token) throw new Error("Token not populated");
    if (!deposit.price) throw new Error("Price not populated");
    if (deposit.outputTokenAddress && !deposit.outputToken) throw new Error("Output token not populated");
    if (deposit.outputTokenAddress && !deposit.outputTokenPrice) throw new Error("Output token price not populated");

    const fillEventsVersion = this.getFillEventsVersion(deposit);
    if (!fillEventsVersion) throw new Error("Fill events version not found");

    if (fillEventsVersion === AcrossContractsVersion.V2_5) {
      await this.computeFeeBreakdownForV2FillEvents(deposit);
    } else if (fillEventsVersion === AcrossContractsVersion.V3) {
      await this.computeFeeBreakdownForV3FillEvents(deposit);
    }
  }

  private async computeFeeBreakdownForV2FillEvents(deposit: Deposit) {
    const typedFillTx = deposit.fillTxs as DepositFillTx2[];
    const fillTx = typedFillTx.find((fillTx) => fillTx.totalFilledAmount === deposit.amount);

    if (!fillTx) return;

    const feeBreakdown = await this.getFeeBreakdownForFillTx(
      fillTx,
      deposit.price.usd,
      deposit.token.decimals,
      deposit.destinationChainId,
    );
    await this.depositRepository.update({ id: deposit.id }, { feeBreakdown });

    this.scraperQueuesService.publishMessage<OpRebateRewardMessage>(ScraperQueue.OpRebateReward, {
      depositPrimaryKey: deposit.id,
    });
  }

  private async computeFeeBreakdownForV3FillEvents(deposit: Deposit) {
    const typedFillTx = deposit.fillTxs as DepositFillTxV3[];
    const fillTx = typedFillTx[0];

    const { feeUsd, fee } = await this.gasFeesService.getFillTxNetworkFee(deposit.destinationChainId, fillTx.hash);
    const relayGasFeeUsd = feeUsd;
    const relayGasFeeAmount = fee;

    // Bridge fee computation
    const wei = new BigNumber(10).pow(18);
    const outputWeiPct = toWeiPct(new BigNumber(fillTx.updatedOutputAmount).dividedBy(deposit.amount).toString());
    const bridgeFeePct = wei.minus(outputWeiPct);
    const inputAmountUsd = new BigNumber(deposit.amount).multipliedBy(deposit.price.usd);
    const outputAmountUsd = new BigNumber(deposit.outputAmount).multipliedBy(deposit.outputTokenPrice.usd);
    const bridgeFeeUsd = inputAmountUsd.minus(outputAmountUsd);
    const bridgeFeeAmount = bridgeFeeUsd.dividedBy(deposit.price.usd);
    const feeBreakdown = {
      lpFeeUsd: undefined,
      lpFeePct: undefined,
      lpFeeAmount: undefined,
      relayCapitalFeeUsd: undefined,
      relayCapitalFeePct: undefined,
      relayCapitalFeeAmount: undefined,
      relayGasFeeUsd,
      // TODO: undefined
      relayGasFeePct: undefined,
      relayGasFeeAmount,
      totalBridgeFeeUsd: bridgeFeeUsd.toString(),
      totalBridgeFeePct: bridgeFeePct.toString(),
      totalBridgeFeeAmount: bridgeFeeAmount.toFixed(0),
    };
    await this.depositRepository.update({ id: deposit.id }, { feeBreakdown });

    this.scraperQueuesService.publishMessage<OpRebateRewardMessage>(ScraperQueue.OpRebateReward, {
      depositPrimaryKey: deposit.id,
    });
  }

  private getFillEventsVersion(deposit: Deposit) {
    const fillsCount = deposit.fillTxs.length;
    const fillsWithTotalFilledAmount = deposit.fillTxs.filter((fillTx) => !!(fillTx as any).totalFilledAmount).length;

    if (fillsCount === fillsWithTotalFilledAmount) {
      return AcrossContractsVersion.V2_5;
    }

    const fillsWithUpdatedOutputAmount = deposit.fillTxs.filter(
      (fillTx) => !!(fillTx as any).updatedOutputAmount,
    ).length;

    if (fillsCount === fillsWithUpdatedOutputAmount) {
      return AcrossContractsVersion.V3;
    }

    return undefined;
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
