import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import {
  DepositFilledDateQueueMessage,
  FeeBreakdownQueueMessage,
  FillEventsQueueMessage2,
  FillEventsV3QueueMessage,
  ScraperQueue,
} from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit, DepositFillTx2, DepositFillTxV3 } from "../../../deposit/model/deposit.entity";
import { Repository } from "typeorm";
import { BigNumber } from "bignumber.js";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.FillEventsV3)
export class FillEventsV3Consumer {
  private logger = new Logger(FillEventsV3Consumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<FillEventsV3QueueMessage>) {
    const { depositId, originChainId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { sourceChainId: originChainId, depositId } });

    if (!deposit) return;
    if (this.fillTxAlreadyProcessed(deposit, job.data)) return;
    await this.processFillEventQueueMessage(deposit, job.data);

    // this.scraperQueuesService.publishMessage<DepositFilledDateQueueMessage>(ScraperQueue.DepositFilledDate, {
    //   depositId: deposit.id,
    // });
    // this.scraperQueuesService.publishMessage<FeeBreakdownQueueMessage>(ScraperQueue.FeeBreakdown, {
    //   depositId: deposit.id,
    // });
  }

  public async processFillEventQueueMessage(deposit: Deposit, data: FillEventsV3QueueMessage) {
    const { transactionHash, fillType, updatedMessage, updatedOutputAmount, updatedRecipient } = data;
    deposit.fillTxs = [
      ...deposit.fillTxs,
      { hash: transactionHash, fillType, updatedMessage, updatedOutputAmount, updatedRecipient },
    ];
    const wei = new BigNumber(10).pow(18);
    const outputPercentage = new BigNumber(updatedOutputAmount).multipliedBy(wei).dividedBy(deposit.amount);
    const bridgeFeePct = wei.minus(outputPercentage);
    deposit.status = "filled";
    deposit.bridgeFeePct = bridgeFeePct.toString();
    deposit.outputAmount = updatedOutputAmount;
    deposit.recipientAddr = updatedRecipient;

    return this.depositRepository.save(deposit);
  }

  private computeBridgeFee(deposit: Deposit, fill: FillEventsQueueMessage2) {
    if (new BigNumber(deposit.amount).eq(0)) {
      return new BigNumber(0);
    }
    const maxBridgeFeePct = new BigNumber(10).pow(18).times(0.0012);
    const validFills = (deposit.fillTxs as DepositFillTx2[]).filter((fill) => fill.relayerFeePct !== "0"); // all fills associated with a deposit that are NOT slow fills
    const relayerFeeChargedToUser = validFills.reduce((cumulativeFee, fill) => {
      const relayerFee = new BigNumber(fill.fillAmount).multipliedBy(fill.relayerFeePct);
      return relayerFee.plus(cumulativeFee);
    }, new BigNumber(0));
    const blendedRelayerFeePct = relayerFeeChargedToUser.dividedBy(deposit.amount).decimalPlaces(0, 1);
    const bridgeFeePct = blendedRelayerFeePct.plus(fill.realizedLpFeePct);
    const bridgeFeePctCapped = BigNumber.min(bridgeFeePct, maxBridgeFeePct);

    return bridgeFeePctCapped;
  }

  public fillTxAlreadyProcessed(deposit: Deposit, fill: FillEventsV3QueueMessage) {
    const { transactionHash } = fill;
    const fillTxIndex = (deposit.fillTxs as DepositFillTxV3[]).findIndex((fillTx) => fillTx.hash === transactionHash);

    // replace if with one line code
    return fillTxIndex !== -1;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.FillEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
