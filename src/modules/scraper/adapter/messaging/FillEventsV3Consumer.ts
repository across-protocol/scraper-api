import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { CappedBridgeFeeQueueMessage, DepositFilledDateQueueMessage, FeeBreakdownQueueMessage, FillEventsV3QueueMessage, ScraperQueue } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit, DepositFillTxV3 } from "../../../deposit/model/deposit.entity";
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

    this.scraperQueuesService.publishMessage<DepositFilledDateQueueMessage>(ScraperQueue.DepositFilledDate, {
      depositId: deposit.id,
    });
    this.scraperQueuesService.publishMessage<FeeBreakdownQueueMessage>(ScraperQueue.FeeBreakdown, {
      depositId: deposit.id,
    });
    this.scraperQueuesService.publishMessage<CappedBridgeFeeQueueMessage>(ScraperQueue.CappedBridgeFee, {
      depositId: deposit.id,
    });
  }

  public async processFillEventQueueMessage(deposit: Deposit, data: FillEventsV3QueueMessage) {
    const { transactionHash, fillType, updatedMessage, updatedOutputAmount, updatedRecipient } = data;
    const fillTxs = [
      ...deposit.fillTxs,
      { hash: transactionHash, fillType, updatedMessage, updatedOutputAmount, updatedRecipient },
    ];

    await this.depositRepository.update(
      { id: deposit.id },
      {
        status: "filled",
        outputAmount: updatedOutputAmount,
        recipientAddr: updatedRecipient,
        fillTxs,
      },
    );

    return this.depositRepository.findOne({ where: { id: deposit.id } });
  }

  public fillTxAlreadyProcessed(deposit: Deposit, fill: FillEventsV3QueueMessage) {
    const { transactionHash } = fill;
    const fillTxIndex = (deposit.fillTxs as DepositFillTxV3[]).findIndex((fillTx) => fillTx.hash === transactionHash);
    return fillTxIndex !== -1;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.FillEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
