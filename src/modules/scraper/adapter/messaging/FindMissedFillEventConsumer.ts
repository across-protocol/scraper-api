import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { DateTime } from "luxon";

import { FillEventsV3QueueMessage, FindMissedFillEventQueueMessage, ScraperQueue } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, Repository } from "typeorm";
import { FindMissedFillEventJob } from "../../model/FindMissedFillEventJob.entity";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { AcrossContractsVersion } from "../../../web3/model/across-version";
import { Block } from "../../../web3/model/block.entity";
import { FilledV3RelayEvent } from "../../../web3/model";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { Deposit } from "../../../deposit/model/deposit.entity";

@Processor(ScraperQueue.FindMissedFillEvent)
export class FindMissedFillEventConsumer {
  private logger = new Logger(FindMissedFillEventConsumer.name);

  constructor(
    @InjectRepository(FindMissedFillEventJob)
    private findMissedFillEventJobRepository: Repository<FindMissedFillEventJob>,
    @InjectRepository(Block)
    private blockRepository: Repository<Block>,
    @InjectRepository(Deposit)
    private depositRepository: Repository<Deposit>,
    private ethProvidersService: EthProvidersService,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<FindMissedFillEventQueueMessage>) {
    const { jobId } = job.data;
    const j = await this.findMissedFillEventJobRepository.findOne({ where: { id: jobId } });

    if (!j) return;

    const deposit = await this.depositRepository.findOne({ where: { id: j.depositPrimaryKey }, select: ["status"] });
    if (deposit.status === "filled") return;

    const maxFillDate = DateTime.fromJSDate(j.depositDate).plus({ hours: 24 }).toJSDate();
    const fromBlock = await this.blockRepository.findOne({
      where: { chainId: j.destinationChainId, date: LessThanOrEqual(j.depositDate) },
      order: { date: "DESC" },
    });
    const toBlock = await this.blockRepository.findOne({
      where: { chainId: j.destinationChainId, date: LessThanOrEqual(maxFillDate) },
      order: { date: "DESC" },
    });

    this.logger.verbose(
      `Find fill for deposit ${j.depositPrimaryKey} (${j.depositDate.toISOString()}) from block ${
        fromBlock.blockNumber
      } (${fromBlock.date.toISOString()}) to block ${toBlock.blockNumber} (${toBlock.date.toISOString()})`,
    );

    if (DateTime.fromJSDate(fromBlock.date).diff(DateTime.fromJSDate(toBlock.date), ["seconds"]).seconds < 10) {
      throw new Error(`Not enough time between blocks: ${DateTime.fromJSDate(fromBlock.date).diff(DateTime.fromJSDate(toBlock.date), ["seconds"]).seconds}`);
    }

    const event = await this.ethProvidersService
      .getSpokePoolEventQuerier(j.destinationChainId, AcrossContractsVersion.V3)
      .getFilledV3RelayEvent(fromBlock.blockNumber, toBlock.blockNumber, j.originChainId, j.depositId);

    if (!event) {
      const diff = DateTime.now().diff(DateTime.fromJSDate(j.depositDate), ["hours"]);

      if (diff.hours > 24) {
        this.logger.verbose(`Deposit ${j.depositPrimaryKey} is too old`);
        return;
      }
    }

    const typedEvent = event as FilledV3RelayEvent;
    const message: FillEventsV3QueueMessage = {
      updatedRecipient: typedEvent.args.relayExecutionInfo.updatedRecipient,
      updatedMessage: typedEvent.args.relayExecutionInfo.updatedMessage,
      updatedOutputAmount: typedEvent.args.relayExecutionInfo.updatedOutputAmount.toString(),
      fillType: typedEvent.args.relayExecutionInfo.fillType,
      depositId: typedEvent.args.depositId,
      originChainId: typedEvent.args.originChainId.toNumber(),
      transactionHash: typedEvent.transactionHash,
    };
    await this.scraperQueuesService.publishMessage<FillEventsV3QueueMessage>(ScraperQueue.FillEventsV3, message);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${JSON.stringify(job.data)} failed: ${error}`);
  }
}
