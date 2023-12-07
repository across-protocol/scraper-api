import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { utils, constants } from "ethers";
import BigNumber from "bignumber.js";
import { DateTime } from "luxon";

import { TrackFillEventQueueMessage, ScraperQueue } from ".";
import { Deposit, DepositFillTx, DepositFillTx2 } from "../../../deposit/model/deposit.entity";
import { TrackService } from "../amplitude/track-service";
import { GasFeesService } from "../gas-fees/gas-fees-service";
import { deriveRelayerFeeComponents, makeAmountValuesFormatter, makePctValuesCalculator } from "../..//utils";
import { chainIdToInfo } from "../../../../utils";

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

    const { depositId, fillTxHash, destinationToken } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId }, relations: ["token", "price"] });

    if (!deposit) {
      this.logger.verbose("Deposit not found in db");
      return;
    }

    if (!deposit.token || !deposit.price || !deposit.depositDate) {
      throw new Error("Can not track fill event without token, price or deposit date");
    }

    const fillTx = deposit.fillTxs.find((tx) => tx.hash === fillTxHash);

    if (!fillTx) {
      throw new Error("Fill tx does not exist on deposit");
    }

    if (!fillTx.date) {
      throw new Error("Fill tx does not have a date");
    }

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

    const fillAmounts = formatAmountValues(fillTx.fillAmount);
    const totalFilledAmounts = formatAmountValues(fillTx.totalFilledAmount);

    const calcPctValues = makePctValuesCalculator(
      fromAmounts.formattedAmount,
      deposit.price.usd,
      deposit.token.decimals,
    );
    const lpFeePctValues = calcPctValues(fillTx.realizedLpFeePct);
    const fillRelayerFeePct = (fillTx as DepositFillTx).appliedRelayerFeePct
      ? (fillTx as DepositFillTx).appliedRelayerFeePct
      : (fillTx as DepositFillTx2).relayerFeePct;
    const relayFeePctValues = calcPctValues(fillRelayerFeePct);
    const bridgeFeePctValues = calcPctValues(new BigNumber(fillTx.realizedLpFeePct).plus(fillRelayerFeePct).toString());

    const { gasFeePct, capitalFeeUsd, capitalFeePct } = deriveRelayerFeeComponents(
      feeUsd,
      relayFeePctValues.pctAmountUsd,
      relayFeePctValues.pct.toString(),
    );

    this.trackService.trackDepositFilledEvent(deposit.depositorAddr, {
      capitalFeePct,
      capitalFeeTotal: new BigNumber(capitalFeePct).dividedBy(100).multipliedBy(fromAmounts.formattedAmount).toFixed(),
      capitalFeeTotalUsd: capitalFeeUsd,
      depositCompleteTimestamp: String(DateTime.fromJSDate(deposit.depositDate).toMillis()),
      fillAmount: fillAmounts.formattedAmount,
      fillAmountUsd: fillAmounts.formattedAmountUsd,
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
      lpFeePct: lpFeePctValues.formattedPct,
      lpFeeTotal: lpFeePctValues.formattedPctAmount,
      lpFeeTotalUsd: lpFeePctValues.pctAmountUsd,
      networkFeeNative: fee,
      networkFeeNativeToken: destinationChainInfo.nativeSymbol.toUpperCase(),
      networkFeeUsd: feeUsd,
      recipient: deposit.recipientAddr,
      referralProgramAddress: deposit.referralAddress || "-",
      relayFeePct: relayFeePctValues.formattedPct,
      relayFeeTotal: relayFeePctValues.formattedPctAmount,
      relayFeeTotalUsd: relayFeePctValues.pctAmountUsd,
      relayGasFeePct: gasFeePct,
      relayGasFeeTotal: new BigNumber(gasFeePct).dividedBy(100).multipliedBy(fromAmounts.formattedAmount).toFixed(),
      relayGasFeeTotalUsd: feeUsd,
      routeChainIdFromTo: `${deposit.sourceChainId}-${deposit.destinationChainId}`,
      routeChainNameFromTo: `${sourceChainInfo.name}-${destinationChainInfo.name}`,
      sender: deposit.depositorAddr,
      succeeded: true,
      toAmount: new BigNumber(fromAmounts.formattedAmount).minus(bridgeFeePctValues.formattedPctAmount).toFixed(),
      toAmountUsd: new BigNumber(fromAmounts.formattedAmountUsd)
        .minus(bridgeFeePctValues.pctAmountUsd)
        .multipliedBy(depositTokenPriceUsd)
        .toFixed(),
      toChainId: String(deposit.destinationChainId),
      toChainName: destinationChainInfo.name,
      tokenSymbol: deposit.token.symbol.toUpperCase(),
      totalBridgeFee: bridgeFeePctValues.formattedPctAmount,
      totalBridgeFeePct: bridgeFeePctValues.formattedPct,
      totalBridgeFeeUsd: bridgeFeePctValues.pctAmountUsd,
      totalFilledAmount: totalFilledAmounts.formattedAmount,
      totalFilledAmountUsd: totalFilledAmounts.formattedAmountUsd,
      // Old queued up redis jobs might not have the `destinationToken` field,
      // so we default to `0x0000000000000000000000000000000000000000`
      toTokenAddress: utils.getAddress(destinationToken || constants.AddressZero),
      transactionHash: fillTx.hash,
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TrackFillEvent} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
