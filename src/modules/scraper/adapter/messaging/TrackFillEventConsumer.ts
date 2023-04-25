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
import {
  deriveRelayerFeeComponents,
  fixedPointAdjustment,
  makeAmountValuesFormatter,
  makeWeiPctValuesFormatter,
} from "../amplitude/utils";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { chainIdToInfo } from "../../../../utils";
import { MarketPriceService } from "../../../market-price/services/service";

@Processor(ScraperQueue.TrackFillEvent)
export class TrackFillEventConsumer {
  private logger = new Logger(TrackFillEventConsumer.name);

  constructor(
    private providers: EthProvidersService,
    private marketPriceService: MarketPriceService,
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

    const { fee, feeUsd, fillTxBlockNumber } = await this.getFillTxNetworkFee(deposit.destinationChainId, fillTx.hash);

    const formatAmountValues = makeAmountValuesFormatter(deposit.token.decimals, depositTokenPriceUsd);
    const fromAmounts = formatAmountValues(deposit.amount);

    const fillAmounts = formatAmountValues(fillTx.fillAmount);
    const totalFilledAmounts = formatAmountValues(fillTx.totalFilledAmount);

    const formatWeiPctValues = makeWeiPctValuesFormatter(fromAmounts.formattedAmount, deposit.price.usd);
    const formattedLpFeeValues = formatWeiPctValues(fillTx.realizedLpFeePct);
    const fillRelayerFeePct = (fillTx as DepositFillTx).appliedRelayerFeePct
      ? (fillTx as DepositFillTx).appliedRelayerFeePct
      : (fillTx as DepositFillTx2).relayerFeePct;
    const formattedRelayFeeValues = formatWeiPctValues(fillRelayerFeePct);
    const formattedBridgeFeeValues = formatWeiPctValues(
      new BigNumber(fillTx.realizedLpFeePct).plus(fillRelayerFeePct).toString(),
    );

    const { gasFeePct, capitalFeeUsd, capitalFeePct } = deriveRelayerFeeComponents(
      feeUsd,
      formattedRelayFeeValues.totalUsd,
      formattedRelayFeeValues.pct,
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
      lpFeePct: formattedLpFeeValues.pct,
      lpFeeTotal: formattedLpFeeValues.total,
      lpFeeTotalUsd: formattedLpFeeValues.totalUsd,
      networkFeeNative: fee,
      networkFeeNativeToken: destinationChainInfo.nativeSymbol.toUpperCase(),
      networkFeeUsd: feeUsd,
      recipient: deposit.recipientAddr,
      referralProgramAddress: deposit.referralAddress || "-",
      relayFeePct: formattedRelayFeeValues.pct,
      relayFeeTotal: formattedRelayFeeValues.total,
      relayFeeTotalUsd: formattedRelayFeeValues.totalUsd,
      relayGasFeePct: gasFeePct,
      relayGasFeeTotal: new BigNumber(gasFeePct).dividedBy(100).multipliedBy(fromAmounts.formattedAmount).toFixed(),
      relayGasFeeTotalUsd: feeUsd,
      routeChainIdFromTo: `${deposit.sourceChainId}-${deposit.destinationChainId}`,
      routeChainNameFromTo: `${sourceChainInfo.name}-${destinationChainInfo.name}`,
      sender: deposit.depositorAddr,
      succeeded: true,
      toAmount: new BigNumber(fromAmounts.formattedAmount).minus(formattedBridgeFeeValues.total).toFixed(),
      toAmountUsd: new BigNumber(fromAmounts.formattedAmountUsd)
        .minus(formattedBridgeFeeValues.totalUsd)
        .multipliedBy(depositTokenPriceUsd)
        .toFixed(),
      toChainId: String(deposit.destinationChainId),
      toChainName: destinationChainInfo.name,
      tokenSymbol: deposit.token.symbol.toUpperCase(),
      totalBridgeFee: formattedBridgeFeeValues.total,
      totalBridgeFeePct: formattedBridgeFeeValues.pct,
      totalBridgeFeeUsd: formattedBridgeFeeValues.totalUsd,
      totalFilledAmount: totalFilledAmounts.formattedAmount,
      totalFilledAmountUsd: totalFilledAmounts.formattedAmountUsd,
      // Old queued up redis jobs might not have the `destinationToken` field,
      // so we default to `0x0000000000000000000000000000000000000000`
      toTokenAddress: utils.getAddress(destinationToken || constants.AddressZero),
      transactionHash: fillTx.hash,
    });
  }

  private async getFillTxNetworkFee(destinationChainId: number, fillTxHash: string) {
    const destinationChainProvider = this.providers.getProvider(destinationChainId);
    const destinationChainInfo = chainIdToInfo[destinationChainId];

    if (!destinationChainProvider || !destinationChainInfo) {
      return {
        fillTxBlockNumber: 0,
        fee: "0",
        feeUsd: "0",
      };
    }

    const fillTxReceipt = await destinationChainProvider.getTransactionReceipt(fillTxHash);
    // Some chains, e.g. Optimism, do not return the effective gas price in the receipt. We need to fetch it separately.
    const gasPrice = fillTxReceipt.effectiveGasPrice || (await destinationChainProvider.getGasPrice());
    const fillTxGasCostsWei = gasPrice.mul(fillTxReceipt.gasUsed).toString();
    const fillTxBlock = await this.providers.getCachedBlock(destinationChainId, fillTxReceipt.blockNumber);
    const nativeTokenPriceUsd = await this.marketPriceService.getCachedHistoricMarketPrice(
      fillTxBlock.date,
      destinationChainInfo.nativeSymbol.toLowerCase(),
    );
    const fee = new BigNumber(fillTxGasCostsWei).dividedBy(fixedPointAdjustment);

    return {
      fillTxBlockNumber: fillTxBlock.blockNumber,
      fee: fee.toFixed(),
      feeUsd: fee.multipliedBy(nativeTokenPriceUsd.usd).toFixed(),
    };
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TrackFillEvent} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
