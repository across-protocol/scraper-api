import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { utils } from "@across-protocol/sdk-v2";
import { RelayData } from "@across-protocol/sdk-v2/dist/types/interfaces";
import { Job } from "bull";
import {
  CappedBridgeFeeQueueMessage,
  DepositFilledDateQueueMessage,
  FeeBreakdownQueueMessage,
  FillEventsV3QueueMessage,
  ScraperQueue,
} from ".";
import { Deposit, DepositFillTxV3 } from "../../../deposit/model/deposit.entity";
import { Repository } from "typeorm";
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

    try {
      const isValidFill = this.validateV3FillEventForDeposit(data, deposit);
      if (!isValidFill) {
        this.logger.log(`${ScraperQueue.FillEventsV3} Skipping event - Invalid fill found for deposit id ${deposit.id}.`);
        this.logger.log(`${ScraperQueue.FillEventsV3} Invalid fill: ${JSON.stringify({ ...data, outputAmount: updatedOutputAmount, inputAmount: deposit.amount })}`);
        return;
      }
    } catch (error) {
      const invalidArgumentErrorCode = 'INVALID_ARGUMENT';
      if (error.code === invalidArgumentErrorCode) {
        this.logger.log(`${ScraperQueue.FillEventsV3} Skipping event - Missing field ${error.argument} in FillEventV3 message`);
        return;
      }
    }

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

  private validateV3FillEventForDeposit(
    fill: FillEventsV3QueueMessage,
    deposit: Deposit,
  ) {
    const fillRelayData: RelayData = {
      originChainId: fill.originChainId,
      depositor: fill.depositor,
      recipient: fill.updatedRecipient,
      depositId: fill.depositId,
      inputToken: fill.inputToken,
      inputAmount: fill.inputAmount,
      outputToken: fill.outputToken,
      outputAmount: fill.outputAmount,
      message: fill.updatedMessage,
      fillDeadline: fill.fillDeadline,
      exclusiveRelayer: fill.exclusiveRelayer,
      exclusivityDeadline: fill.exclusivityDeadline,
    };
    const fillRelayDataHash = utils.getRelayDataHash(fillRelayData, fill.destinationChainId);

    const depositRelayData: RelayData = {
      originChainId: deposit.sourceChainId,
      depositor: deposit.depositorAddr,
      recipient: deposit.recipientAddr,
      depositId: deposit.depositId,
      inputToken: deposit.tokenAddr,
      inputAmount: utils.toBN(deposit.amount),
      outputToken: deposit.outputTokenAddress,
      outputAmount: utils.toBN(deposit.outputAmount),
      message: deposit.message,
      fillDeadline: deposit.fillDeadline.getTime() / 1000,
      exclusiveRelayer: deposit.relayer,
      exclusivityDeadline: deposit.exclusivityDeadline
        ? deposit.exclusivityDeadline.getTime() / 1000
        : 0,
    };
    const depositRelayDataHash = utils.getRelayDataHash(depositRelayData, deposit.destinationChainId);

    return fillRelayDataHash === depositRelayDataHash;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.FillEventsV3} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
