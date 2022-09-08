import { Injectable, Logger } from "@nestjs/common";
import { EthProvidersService } from "../web3/services/EthProvidersService";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ChainIds } from "../web3/model/ChainId";
import { AppConfig } from "../configuration/configuration.service";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { ScraperQueuesService } from "./service/ScraperQueuesService";
import { BlocksEventsQueueMessage, ScraperQueue } from "./adapter/messaging";
import { wait } from "../../utils";

type Task = Record<string, { from: number; to: number }>;

@Injectable()
export class ScraperService {
  private logger = new Logger(ScraperService.name);

  public constructor(
    private providers: EthProvidersService,
    private appConfig: AppConfig,
    @InjectRepository(ProcessedBlock)
    private processedBlockRepository: Repository<ProcessedBlock>,
    private scraperQueuesService: ScraperQueuesService,
  ) {
    this.run();
  }

  public async run() {
    while (true) {
      try {
        if (this.appConfig.values.enableSpokePoolsEventsProcessing) {
          await this.publishBlocks();
        }
      } catch (error) {
        this.logger.error(error);
      }
      await wait(20);
    }
  }

  public async publishBlocks() {
    const latestBlocks = await this.getLatestBlocks();
    this.logger.log(JSON.stringify(latestBlocks));
    const blockRanges = await this.determineBlockRanges(latestBlocks);

    for (const chainId of Object.keys(blockRanges)) {
      const { from, to } = blockRanges[chainId];
      await this.scraperQueuesService.publishMessage<BlocksEventsQueueMessage>(ScraperQueue.BlocksEvents, {
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
      let from = 1;

      if (previousProcessedBlock) {
        from = previousProcessedBlock.latestBlock + 1;
      } else if (configStartBlockNumber) {
        from = configStartBlockNumber;
      }

      const to = Math.min(
        latestBlocks[chainId] - this.getFollowingDistance(parseInt(chainId)),
        from + this.getMinBlockRange(parseInt(chainId)),
      );
      if (from < to) {
        blockRanges[chainId] = { from, to };

        if (!previousProcessedBlock) {
          previousProcessedBlock = this.processedBlockRepository.create({
            chainId: parseInt(chainId),
            latestBlock: to,
          });
        } else {
          previousProcessedBlock.latestBlock = to;
        }
        await this.processedBlockRepository.save(previousProcessedBlock);
      }
    }

    return blockRanges;
  }

  public getMinBlockRange(chainId: number) {
    if (chainId === ChainIds.boba) {
      return 50_000;
    }

    return 100_000;
  }

  public getFollowingDistance(chainId: number) {
    const distanceFromConfig = this.appConfig.values.followingDistances[chainId];
    if (distanceFromConfig) {
      return Number(distanceFromConfig);
    }

    if ([ChainIds.polygon, ChainIds.polygonMumbai].includes(chainId)) {
      return 100;
    }

    return 10;
  }
}
