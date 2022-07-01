import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import fs from "fs";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import {
  BlockNumberQueueMessage,
  BlocksEventsQueueMessage,
  FillEventsQueueMessage,
  ScraperQueue,
} from ".";
import { FundsDepositedEvent, FilledRelayEvent } from "@across-protocol/contracts-v2/dist/typechain/SpokePool";
import { Deposit } from "../../model/deposit.entity";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.BlocksEvents)
export class BlocksEventsConsumer {
  private logger = new Logger(BlocksEventsConsumer.name);

  constructor(
    private providers: EthProvidersService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process({ concurrency: 5 })
  private async process(job: Job<BlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const depositEvents: FundsDepositedEvent[] = await this.providers
      .getSpokePoolEventQuerier(chainId)
      .getFundsDepositEvents(from, to);
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${depositEvents.length} FundsDepositedEvent`);
    const fillEvents: FilledRelayEvent[] = await this.providers
      .getSpokePoolEventQuerier(chainId)
      .getFilledRelayEvents(from, to);
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${fillEvents.length} FilledRelayEvent`);

    for (const event of depositEvents) {
      const { transactionHash, blockNumber } = event;
      const { depositId, originChainId, destinationChainId, amount, originToken, depositor } = event.args;

      try {
        const result = await this.depositRepository.insert({
          depositId,
          sourceChainId: originChainId.toNumber(),
          destinationChainId: destinationChainId.toNumber(),
          status: "pending",
          amount: amount.toString(),
          filled: "0",
          tokenAddr: originToken,
          depositTxHash: transactionHash,
          fillTxs: [],
          blockNumber,
          depositorAddr: depositor,
        });
        await this.scraperQueuesService.publishMessage<BlockNumberQueueMessage>(ScraperQueue.BlockNumber, {
          depositId: result.identifiers[0].id,
        });
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          // Ignore duplicate key value violates unique constraint error.
          this.logger.warn(error);
        } else {
          throw error;
        }
      }
    }

    const fillMessages: FillEventsQueueMessage[] = fillEvents.map((e) => ({
      depositId: e.args.depositId,
      originChainId: e.args.originChainId.toNumber(),
      realizedLpFeePct: e.args.realizedLpFeePct.toString(),
      totalFilledAmount: e.args.totalFilledAmount.toString(),
      transactionHash: e.transactionHash,
    }));
    await this.scraperQueuesService.publishMessagesBulk<FillEventsQueueMessage>(ScraperQueue.FillEvents, fillMessages);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.BlocksEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
