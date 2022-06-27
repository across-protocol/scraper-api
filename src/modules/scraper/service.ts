import { Injectable, Logger } from "@nestjs/common";
import { EthProvidersService } from "../web3/services/EthProvidersService";
import { QueueObject } from "async";
import { ChainIds } from "../web3/model/ChainId";
import { FundsDepositedEvent, FilledRelayEvent } from "@across-protocol/contracts-v2/dist/typechain/SpokePool";
import { AppConfig } from "../configuration/configuration.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { TypedEvent } from "@across-protocol/contracts-v2/dist/typechain/common";
import retry from "async-retry";
import { ScraperQueuesService } from "./service/ScraperQueuesService";
import { BlocksBatchQueueMessage, ScraperQueue } from "./adapter/messaging";

type Task = Record<string, { from: number; to: number }>;

@Injectable()
export class ScraperService {
  private queue: QueueObject<Task>;
  private logger = new Logger(ScraperService.name);

  public constructor(
    private providers: EthProvidersService,
    private appConfig: AppConfig,
    @InjectRepository(ProcessedBlock)
    private processedBlockRepository: Repository<ProcessedBlock>,
    private scraperQueuesService: ScraperQueuesService,
  ) {
    // this.queue = async.queue(this.queueHandler, 1);
    this.run();
  }

  public async run() {
    while (true) {
      try {
        await this.publishBlocks();
      } catch (error) {
        this.logger.error(error);
      }
      await this.wait(20);
    }
  }

  private wait(seconds = 1) {
    return new Promise((res) => {
      setTimeout(res, 1000 * seconds);
    });
  }

  public async publishBlocks() {
    const latestBlocks = await this.getLatestBlocks();
    this.logger.log(JSON.stringify(latestBlocks));
    const blockRanges = await this.determineBlockRanges(latestBlocks);

    for (const chainId of Object.keys(blockRanges)) {
      const { from, to } = blockRanges[chainId];
      await this.scraperQueuesService.publishMessage<BlocksBatchQueueMessage>(ScraperQueue.BlocksBatch, {
        chainId: parseInt(chainId),
        from,
        to,
      });
    }
  }

  /**
   * Fetch the latest block numbers from all supported chains
   */
  public getLatestBlocks = async () => {
    const chainIds = Object.keys(this.providers.getProviders()).map((chainId) => parseInt(chainId));
    const blocks = await Promise.all(chainIds.map((chainId) => this.providers.getProvider(chainId).getBlock("latest")));
    const blockNumbers = blocks.reduce(
      (acc, block, idx) => ({ ...acc, [chainIds[idx]]: block.number }),
      {} as Record<string, number>,
    );

    return blockNumbers;
  };

  /**
   * Compute the start and the end of the next batch of blocks that needs to be processed.
   * `from` is computed depending on the latest block saved in DB || start block number defined in config file || 1
   * `to` is a block number up to the latest block number from chain, but capped at a max value. This way we avoid
   *     huge block ranges to be processed.
   */
  public async determineBlockRanges(latestBlocks: Record<string, number>) {
    const blockRanges: Record<string, { from: number; to: number }> = {};

    for (const chainId of Object.keys(latestBlocks)) {
      let previousProcessedBlock = await this.processedBlockRepository.findOne({
        where: { chainId: parseInt(chainId) },
      });
      const configStartBlockNumber = this.appConfig.values.web3.spokePoolContracts[chainId].startBlockNumber;
      const from = (previousProcessedBlock?.latestBlock || configStartBlockNumber || 0) + 1;
      const to = Math.min(latestBlocks[chainId], from + this.getMinBlockRange(parseInt(chainId)));
      if (from <= to) {
        blockRanges[chainId] = { from, to };
      }

      if (!previousProcessedBlock) {
        previousProcessedBlock = this.processedBlockRepository.create({ chainId: parseInt(chainId), latestBlock: to });
      } else {
        previousProcessedBlock.latestBlock = to;
      }
      await this.processedBlockRepository.save(previousProcessedBlock);
    }

    return blockRanges;
  }

  // public queueHandler: async.AsyncWorker<Task> = async (task) => {
  //   await this.retry(async () => {
  //     await this.processBlockNumbers(task);
  //   }, 5);
  // };

  // public processBlockNumbers = async (task: Task) => {
  //   await Promise.all(
  //     Object.keys(task).map((chainId) =>
  //       this.processBlockNumber(parseInt(chainId), task[chainId].from, task[chainId].to),
  //     ),
  //   );
  //   await Promise.all(
  //     Object.keys(task).map((chainId) =>
  //       this.processedBlockRepository.insert({
  //         to: task[chainId].to,
  //         from: task[chainId].from,
  //         chainId: parseInt(chainId),
  //       }),
  //     ),
  //   );
  // };

  public processBlockNumber = async (chainId: number, from: number, to: number) => {
    this.logger.log(`chainId ${chainId} - process`);
    const depositEvents: FundsDepositedEvent[] = await this.providers
      .getSpokePoolEventQuerier(chainId)
      .getFundsDepositEvents(from, to);
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${depositEvents.length} FundsDepositedEvent`);
    const fillEvents: FilledRelayEvent[] = await this.providers
      .getSpokePoolEventQuerier(chainId)
      .getFilledRelayEvents(from, to);
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${fillEvents.length} FilledRelayEvent`);
    const blockTimestampMap = await this.getBlocksTimestamp(depositEvents, chainId);
  };

  // public submitBlocksForProcessing = async (latestBlocks: Record<string, number>) => {
  //   let task: Task = {};

  //   for (const chainId of Object.keys(latestBlocks)) {
  //     const previousProcessedBlock = await this.processedBlockRepository.findOne({
  //       where: { chainId: parseInt(chainId) },
  //       order: { to: "DESC" },
  //     });
  //     const configStartBlockNumber = this.appConfig.values.web3.spokePoolContracts[chainId].startBlockNumber;
  //     const from = (previousProcessedBlock?.to || configStartBlockNumber || 0) + 1;
  //     const to = Math.min(latestBlocks[chainId], from + this.getMinBlockRange(parseInt(chainId)));
  //     if (from <= to) {
  //       task = { ...task, [chainId]: { from, to } };
  //     }
  //   }
  //   await this.queue.push(task);
  // };

  public retry = async (func: () => void, delaySeconds: number) => {
    let hasToRetry = false;
    do {
      try {
        const result = await func();
        hasToRetry = false;
        return result;
      } catch (error) {
        hasToRetry = true;
        this.logger.error(`retry in ${delaySeconds}s error: ${error}`);
      }
      await this.wait(delaySeconds);
    } while (hasToRetry);
  };

  /**
   * Take and array of contract events and return the timestamp of the blocks as a dictionary
   * @param events
   */
  private async getBlocksTimestamp(events: TypedEvent<any>[], chainId: number) {
    const uniqueBlockNumbers = events.reduce((acc, event) => {
      return { ...acc, [event.blockNumber]: true };
    }, {} as Record<number, any>);
    const uniqueBlockNumbersList = Object.keys(uniqueBlockNumbers).map((blockNumber) => parseInt(blockNumber));
    let blockTimestampMap = {};
    this.logger.log(`chainId ${chainId} - fetch ${uniqueBlockNumbersList.length} blocks`);
    const blocksChunks = this.getArrayChunks(uniqueBlockNumbersList, 20);
    for (const blocksChunk of blocksChunks) {
      const blocks = await Promise.all(blocksChunk.map((blockNumber) => this.getBlockWithRetry(chainId, blockNumber)));
      blockTimestampMap = {
        ...blockTimestampMap,
        ...blocks.reduce((acc, block) => ({ ...acc, [block.blockNumber]: block.date }), {}),
      };
    }
    this.logger.log(`chainId ${chainId} - fetched ${Object.keys(blockTimestampMap).length} blocks`);
    return blockTimestampMap;
  }

  public getBlockWithRetry(chainId: number, blockNumber: number) {
    return retry(
      () => {
        return this.providers.getCachedBlock(chainId, blockNumber);
      },
      {
        retries: 5,
      },
    );
  }

  private getArrayChunks(array: any[], chunkSize = 50) {
    return Array(Math.ceil(array.length / chunkSize))
      .fill([])
      .map((_, index) => index * chunkSize)
      .map((begin) => array.slice(begin, begin + chunkSize));
  }

  public getMinBlockRange(chainId: number) {
    if (chainId === ChainIds.boba) {
      return 50_000;
    }

    return 100_000;
  }
}
