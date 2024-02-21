import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { SpeedUpEventsV3QueueMessage, ScraperQueue } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit, RequestedSpeedUpDepositTxV3 } from "../../../deposit/model/deposit.entity";
import { Repository } from "typeorm";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import BigNumber from "bignumber.js";

@Processor(ScraperQueue.SpeedUpEventsV3)
export class SpeedUpEventsV3Consumer {
  private logger = new Logger(SpeedUpEventsV3Consumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<SpeedUpEventsV3QueueMessage>) {
    const { depositId, depositSourceChainId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { sourceChainId: depositSourceChainId, depositId } });

    if (!deposit) throw new Error("Deposit not found");

    if (this.isSpeedUpAlreadyProcessed(deposit, job.data)) return;

    await this.processSpeedUpEventQueueMessage(deposit, job.data);
  }

  public async processSpeedUpEventQueueMessage(deposit: Deposit, data: SpeedUpEventsV3QueueMessage) {
    const {
      transactionHash,
      blockNumber,
      depositSourceChainId,
      updatedOutputAmount,
      updatedMessage,
      updatedRecipient,
    } = data;

    const sortedSpeedUps = [
      ...deposit.speedUps,
      {
        hash: transactionHash,
        updatedOutputAmount,
        blockNumber,
        depositSourceChainId,
        updatedMessage,
        updatedRecipient,
      },
    ].sort((a, b) => b.blockNumber - a.blockNumber) as RequestedSpeedUpDepositTxV3[];
    const wei = new BigNumber(10).pow(18);
    const feePct = wei.minus(wei.multipliedBy(updatedOutputAmount).dividedBy(deposit.amount));
    return this.depositRepository.update(
      { id: deposit.id },
      {
        speedUps: sortedSpeedUps,
        message: sortedSpeedUps[0].updatedMessage,
        recipientAddr: sortedSpeedUps[0].updatedRecipient,
        outputAmount: sortedSpeedUps[0].updatedOutputAmount,
        depositRelayerFeePct: feePct.toFixed(0),
      },
    );
  }

  public isSpeedUpAlreadyProcessed(deposit: Deposit, speedUp: SpeedUpEventsV3QueueMessage) {
    const { transactionHash } = speedUp;
    const speedUpTxIndex = deposit.speedUps.findIndex((speedUpTx) => speedUpTx.hash === transactionHash);
    return speedUpTxIndex !== -1;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.SpeedUpEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
