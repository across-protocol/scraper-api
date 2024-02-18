import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { DepositFilledDateQueueMessage, ScraperQueue, SpeedUpEventsQueueMessage } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit, RequestedSpeedUpDepositTx } from "../../../deposit/model/deposit.entity";
import { Repository } from "typeorm";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.SpeedUpEvents)
export class SpeedUpEventsConsumer {
  private logger = new Logger(SpeedUpEventsConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<SpeedUpEventsQueueMessage>) {
    const { depositId, depositSourceChainId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { sourceChainId: depositSourceChainId, depositId } });

    if (!deposit) {
      throw new Error(
        `RequestedSpeedUpDeposit event for deposit with depositId '${depositId}' and sourceChainId '${depositSourceChainId}' could not be processed: deposit not found in db`,
      );
    }

    if (this.isSpeedUpAlreadyProcessed(deposit, job.data)) {
      this.logger.warn("RequestedSpeedUpDeposit event already processed");
      return;
    }

    await this.processSpeedUpEventQueueMessage(deposit, job.data);

    this.scraperQueuesService.publishMessage<DepositFilledDateQueueMessage>(ScraperQueue.DepositFilledDate, {
      depositId: deposit.id,
    });
  }

  public async processSpeedUpEventQueueMessage(deposit: Deposit, data: SpeedUpEventsQueueMessage) {
    const { transactionHash, newRelayerFeePct, blockNumber, depositSourceChainId, updatedMessage, updatedRecipient } =
      data;

    const sortedSpeedUps = [
      ...deposit.speedUps,
      { hash: transactionHash, newRelayerFeePct, blockNumber, depositSourceChainId, updatedMessage, updatedRecipient },
    ].sort((a, b) => b.blockNumber - a.blockNumber) as RequestedSpeedUpDepositTx[];

    return this.depositRepository.update(
      { id: deposit.id },
      {
        speedUps: sortedSpeedUps,
        depositRelayerFeePct: sortedSpeedUps[0].newRelayerFeePct,
        message: sortedSpeedUps[0].updatedMessage || deposit.message,
        recipientAddr: sortedSpeedUps[0]?.updatedRecipient || deposit.recipientAddr,
      },
    );
  }

  public isSpeedUpAlreadyProcessed(deposit: Deposit, speedUp: SpeedUpEventsQueueMessage) {
    const { transactionHash } = speedUp;
    const speedUpTxIndex = deposit.speedUps.findIndex((speedUpTx) => speedUpTx.hash === transactionHash);
    return speedUpTxIndex !== -1;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.SpeedUpEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
