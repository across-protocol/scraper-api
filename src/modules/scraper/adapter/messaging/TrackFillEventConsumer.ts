import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { utils } from "ethers";
import { TrackFillEventQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../model/deposit.entity";
import { TrackService } from "../amplitude/track-service";
import { makeWeiPctValuesFormatter } from "../amplitude/utils";
import { ChainIdToName } from "../../../web3/model/ChainId";
import BigNumber from "bignumber.js";

@Processor(ScraperQueue.TrackFillEvent)
export class TrackFillEventConsumer {
  private logger = new Logger(TrackFillEventConsumer.name);

  constructor(
    private trackService: TrackService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
  ) {}

  @Process()
  private async process(job: Job<TrackFillEventQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId }, relations: ["token", "price"] });

    if (!deposit) return;
    if (deposit.status !== "filled") return;

    if (!deposit.token || !deposit.price) {
      throw new Error("Can not track fill event without token or price");
    }

    const amountFormatted = utils.formatUnits(deposit.amount, deposit.token.decimals);
    const weiPctValuesFormatter = makeWeiPctValuesFormatter(amountFormatted, deposit.price.usd);
    const formattedLpFeeValues = weiPctValuesFormatter(deposit.realizedLpFeePct);
    const formattedRelayFeeValues = weiPctValuesFormatter(deposit.depositRelayerFeePct);
    const formattedBridgeFeeValues = weiPctValuesFormatter(deposit.bridgeFeePct);

    this.trackService.trackDepositFilledEvent(deposit.depositorAddr, {
      capitalFeePct: "-",
      capitalFeeTotal: "-",
      capitalFeeTotalUsd: "-",
      fromAmount: amountFormatted,
      fromAmountUsd: new BigNumber(amountFormatted).multipliedBy(deposit.price.usd).toFixed(2),
      fromChainId: String(deposit.sourceChainId),
      fromChainName: ChainIdToName[deposit.sourceChainId],
      fromTokenAddress: deposit.tokenAddr,
      isAmountTooLow: false,
      lpFeePct: formattedLpFeeValues.pct,
      lpFeeTotal: formattedLpFeeValues.total,
      lpFeeTotalUsd: formattedLpFeeValues.totalUsd,
      NetworkFeeNative: "-",
      NetworkFeeNativeToken: "-",
      NetworkFeeUsd: "-",
      recipient: deposit.recipientAddr,
      referralProgramAddress: deposit.referralAddress || "-",
      relayFeePct: formattedRelayFeeValues.pct,
      relayFeeTotal: formattedRelayFeeValues.total,
      relayFeeTotalUsd: formattedRelayFeeValues.totalUsd,
      relayGasFeePct: "-",
      relayGasFeeTotal: "-",
      relayGasFeeTotalUsd: "-",
      routeChainIdFromTo: `${deposit.sourceChainId}-${deposit.destinationChainId}`,
      routeChainNameFromTo: `${ChainIdToName[deposit.sourceChainId]}-${ChainIdToName[deposit.destinationChainId]}`,
      sender: deposit.depositorAddr,
      succeeded: true,
      timeFromTransferSignedToTransferCompleteInMilliseconds: String(
        deposit.filledDate.getTime() - deposit.depositDate.getTime(),
      ),
      toAmount: new BigNumber(amountFormatted).minus(formattedBridgeFeeValues.total).toFixed(),
      toAmountUsd: new BigNumber(amountFormatted)
        .minus(formattedBridgeFeeValues.total)
        .multipliedBy(deposit.price.usd)
        .toFixed(2),
      toChainId: String(deposit.destinationChainId),
      toChainName: ChainIdToName[deposit.destinationChainId],
      tokenSymbol: deposit.token.symbol,
      totalBridgeFee: formattedBridgeFeeValues.total,
      totalBridgeFeePct: formattedBridgeFeeValues.pct,
      totalBridgeFeeUsd: formattedBridgeFeeValues.totalUsd,
      toTokenAddress: deposit.tokenAddr, // TODO: retrieve correct address
      transactionHash: deposit.fillTxs[0].hash, // TODO: determine which tx hash to use
      transferCompleteTimestamp: String(deposit.depositDate.getTime()),
      transferQuoteBlockNumber: "-",
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TrackFillEvent} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
