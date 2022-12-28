import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { utils } from "ethers";
import BigNumber from "bignumber.js";
import { DateTime } from "luxon";

import { TrackFillEventQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../model/deposit.entity";
import { TrackService } from "../amplitude/track-service";
import { fixedPointAdjustment, makeWeiPctValuesFormatter } from "../amplitude/utils";
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
      return;
    }

    const { depositId, fillTxHash, destinationToken } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId }, relations: ["token", "price"] });

    if (!deposit || deposit.status !== "filled") {
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

    const destinationChainProvider = this.providers.getProvider(deposit.destinationChainId);
    const destinationChainInfo = chainIdToInfo[deposit.destinationChainId];
    const sourceChainInfo = chainIdToInfo[deposit.sourceChainId];

    const fillTxReceipt = await destinationChainProvider.getTransactionReceipt(fillTx.hash);
    // Some chains, e.g. Optimism, do not return the effective gas price in the receipt. We need to fetch it separately.
    const gasPrice = fillTxReceipt.effectiveGasPrice || (await destinationChainProvider.getGasPrice());
    const fillTxGasCostsWei = gasPrice.mul(fillTxReceipt.gasUsed).toString();
    const fillTxBlock = await this.providers.getCachedBlock(deposit.destinationChainId, fillTxReceipt.blockNumber);
    const nativeTokenPriceUsd = await this.marketPriceService.getCachedHistoricMarketPrice(
      fillTxBlock.date,
      destinationChainInfo.nativeSymbol.toLowerCase(),
    );

    const amountFormatted = utils.formatUnits(deposit.amount, deposit.token.decimals);
    const weiPctValuesFormatter = makeWeiPctValuesFormatter(amountFormatted, deposit.price.usd);
    const formattedLpFeeValues = weiPctValuesFormatter(fillTx.realizedLpFeePct);
    const formattedRelayFeeValues = weiPctValuesFormatter(fillTx.appliedRelayerFeePct);
    const formattedBridgeFeeValues = weiPctValuesFormatter(
      new BigNumber(fillTx.realizedLpFeePct).plus(fillTx.appliedRelayerFeePct).toString(),
    );

    this.trackService.trackDepositFilledEvent(deposit.depositorAddr, {
      capitalFeePct: "-",
      capitalFeeTotal: "-",
      capitalFeeTotalUsd: "-",
      fromAmount: amountFormatted,
      fromAmountUsd: new BigNumber(amountFormatted).multipliedBy(deposit.price.usd).toFixed(),
      fromChainId: String(deposit.sourceChainId),
      fromChainName: sourceChainInfo.name,
      fromTokenAddress: deposit.tokenAddr,
      isAmountTooLow: false,
      lpFeePct: formattedLpFeeValues.pct,
      lpFeeTotal: formattedLpFeeValues.total,
      lpFeeTotalUsd: formattedLpFeeValues.totalUsd,
      NetworkFeeNative: fillTxGasCostsWei,
      NetworkFeeNativeToken: destinationChainInfo.nativeSymbol,
      NetworkFeeUsd: new BigNumber(fillTxGasCostsWei)
        .dividedBy(fixedPointAdjustment)
        .multipliedBy(nativeTokenPriceUsd.usd)
        .toFixed(),
      recipient: deposit.recipientAddr,
      referralProgramAddress: deposit.referralAddress || "-",
      relayFeePct: formattedRelayFeeValues.pct,
      relayFeeTotal: formattedRelayFeeValues.total,
      relayFeeTotalUsd: formattedRelayFeeValues.totalUsd,
      relayGasFeePct: "-",
      relayGasFeeTotal: "-",
      relayGasFeeTotalUsd: "-",
      routeChainIdFromTo: `${deposit.sourceChainId}-${deposit.destinationChainId}`,
      routeChainNameFromTo: `${sourceChainInfo.name}-${destinationChainInfo.name}`,
      sender: deposit.depositorAddr,
      succeeded: true,
      timeFromTransferSignedToTransferCompleteInMilliseconds: String(
        DateTime.fromISO(fillTx.date).diff(DateTime.fromJSDate(deposit.depositDate)).as("milliseconds"),
      ),
      toAmount: new BigNumber(amountFormatted).minus(formattedBridgeFeeValues.total).toFixed(),
      toAmountUsd: new BigNumber(amountFormatted)
        .minus(formattedBridgeFeeValues.total)
        .multipliedBy(deposit.price.usd)
        .toFixed(),
      toChainId: String(deposit.destinationChainId),
      toChainName: destinationChainInfo.name,
      tokenSymbol: deposit.token.symbol,
      totalBridgeFee: formattedBridgeFeeValues.total,
      totalBridgeFeePct: formattedBridgeFeeValues.pct,
      totalBridgeFeeUsd: formattedBridgeFeeValues.totalUsd,
      toTokenAddress: utils.getAddress(destinationToken),
      transactionHash: fillTx.hash,
      transferCompleteTimestamp: String(deposit.depositDate.getTime()),
      transferQuoteBlockNumber: String(fillTxBlock.blockNumber),
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TrackFillEvent} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
