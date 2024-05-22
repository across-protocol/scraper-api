import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { DateTime } from "luxon";

import { TrackFillEventQueueMessage, ScraperQueue } from ".";
import { Deposit, DepositFillTxV3 } from "../../../deposit/model/deposit.entity";
import { TrackService } from "../amplitude/track-service";
import { GasFeesService } from "../gas-fees/gas-fees-service";
import { makeAmountValuesFormatter } from "../..//utils";
import { chainIdToInfo } from "../../../../utils";
import { TransferFillCompletedProperties } from "src/modules/ampli";

@Processor(ScraperQueue.TrackFillEvent)
export class TrackFillEventConsumer {
  private logger = new Logger(TrackFillEventConsumer.name);

  constructor(
    private gasFeesService: GasFeesService,
    private trackService: TrackService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
  ) {}

  @Process()
  private async process(job: Job<TrackFillEventQueueMessage>) {
    if (!this.trackService.isEnabled()) {
      this.logger.verbose("Amplitude tracking is disabled");
      return;
    }

    const { depositId, fillTxHash } = job.data;
    const deposit = await this.depositRepository.findOne({
      where: { id: depositId },
      relations: ["token", "price", "outputToken", "outputTokenPrice"],
    });

    if (!deposit) return;
    if (!deposit.outputAmount) return;
    if (!deposit.token || !deposit.price || !deposit.depositDate || !deposit.outputToken || !deposit.outputTokenPrice) {
      throw new Error("Can not track fill event without token, price or deposit date");
    }

    if (!deposit.feeBreakdown.totalBridgeFeePct) {
      throw new Error("Fee breakdown is not set");
    }

    const fillTx = deposit.fillTxs.find((tx) => tx.hash === fillTxHash) as DepositFillTxV3;

    if (!fillTx) throw new Error("Fill tx does not exist on deposit");
    if (!fillTx.date) throw new Error("Fill tx does not have a date");

    const destinationChainInfo = chainIdToInfo[deposit.destinationChainId] || {
      name: "unknown",
      chainId: deposit.destinationChainId,
      nativeSymbol: "unknown",
    };
    const sourceChainInfo = chainIdToInfo[deposit.sourceChainId] || {
      name: "unknown",
      chainId: deposit.sourceChainId,
      nativeSymbol: "unknown",
    };
    const depositTokenPriceUsd = deposit.price.usd;

    const { fee, feeUsd } = await this.gasFeesService.getFillTxNetworkFee(deposit.destinationChainId, fillTx.hash);
    const formatAmountValues = makeAmountValuesFormatter(deposit.token.decimals, depositTokenPriceUsd);
    const fromAmounts = formatAmountValues(deposit.amount);

    const event: TransferFillCompletedProperties = {
      capitalFeePct: "",
      capitalFeeTotal: "",
      capitalFeeTotalUsd: "",
      depositCompleteTimestamp: String(DateTime.fromJSDate(deposit.depositDate).toMillis()),
      fillAmount: deposit.outputAmount,
      fillAmountUsd: new BigNumber(deposit.outputAmount)
        .multipliedBy(deposit.outputTokenPrice.usd)
        .dividedBy(new BigNumber(10).pow(deposit.outputToken.decimals))
        .toString(),
      fillCompleteTimestamp: String(DateTime.fromISO(fillTx.date).toMillis()),
      fillTimeInMs: String(
        DateTime.fromISO(fillTx.date).diff(DateTime.fromJSDate(deposit.depositDate)).as("milliseconds"),
      ),
      fromAmount: fromAmounts.formattedAmount,
      fromAmountUsd: fromAmounts.formattedAmountUsd,
      fromChainId: String(deposit.sourceChainId),
      fromChainName: sourceChainInfo.name,
      fromTokenAddress: deposit.tokenAddr,
      isAmountTooLow: false,
      lpFeePct: "",
      lpFeeTotal: "",
      lpFeeTotalUsd: "",
      networkFeeNative: fee,
      networkFeeNativeToken: destinationChainInfo.nativeSymbol.toUpperCase(),
      networkFeeUsd: feeUsd,
      recipient: deposit.recipientAddr,
      referralProgramAddress: deposit.stickyReferralAddress || "-",
      relayFeePct: "",
      relayFeeTotal: "",
      relayFeeTotalUsd: "",
      relayGasFeePct: "",
      relayGasFeeTotal: "",
      relayGasFeeTotalUsd: feeUsd,
      routeChainIdFromTo: `${deposit.sourceChainId}-${deposit.destinationChainId}`,
      routeChainNameFromTo: `${sourceChainInfo.name}-${destinationChainInfo.name}`,
      sender: deposit.depositorAddr,
      succeeded: true,
      toAmount: deposit.outputAmount,
      toAmountUsd: new BigNumber(deposit.outputAmount)
        .multipliedBy(deposit.outputTokenPrice.usd)
        .dividedBy(new BigNumber(10).pow(deposit.outputToken.decimals))
        .toString(),
      toChainId: String(deposit.destinationChainId),
      toChainName: destinationChainInfo.name,
      tokenSymbol: deposit.token.symbol.toUpperCase(),
      totalBridgeFee: deposit.feeBreakdown.totalBridgeFeeAmount,
      totalBridgeFeePct: deposit.feeBreakdown.totalBridgeFeePct,
      totalBridgeFeeUsd: deposit.feeBreakdown.totalBridgeFeeUsd,

      totalFilledAmount: deposit.outputAmount,
      totalFilledAmountUsd: new BigNumber(deposit.outputAmount)
        .multipliedBy(deposit.outputTokenPrice.usd)
        .dividedBy(new BigNumber(10).pow(deposit.outputToken.decimals))
        .toString(),
      // Old queued up redis jobs might not have the `destinationToken` field,
      // so we default to `0x0000000000000000000000000000000000000000`
      toTokenAddress: deposit.outputTokenAddress,
      transactionHash: fillTx.hash,
    };
    await this.trackService.trackDepositFilledEvent(deposit.depositorAddr, event);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TrackFillEvent} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
