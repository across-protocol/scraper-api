import { Injectable, Logger } from "@nestjs/common";
import { EthProvidersService } from "../web3/services/EthProvidersService";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ChainIds } from "../web3/model/ChainId";
import { AppConfig } from "../configuration/configuration.service";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { MerkleDistributorProcessedBlock } from "./model/MerkleDistributorProcessedBlock.entity";
import { ScraperQueuesService } from "./service/ScraperQueuesService";
import { BlocksEventsQueueMessage, MerkleDistributorBlocksEventsQueueMessage, ScraperQueue } from "./adapter/messaging";
import { wait } from "../../utils";

@Injectable()
export class ScraperService {
  private logger = new Logger(ScraperService.name);

  public constructor(
    private providers: EthProvidersService,
    private appConfig: AppConfig,
    @InjectRepository(ProcessedBlock)
    private processedBlockRepository: Repository<ProcessedBlock>,
    @InjectRepository(MerkleDistributorProcessedBlock)
    private merkleDistributorProcessedBlockRepository: Repository<MerkleDistributorProcessedBlock>,
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
        if (this.appConfig.values.enableMerkleDistributorEventsProcessing) {
          await this.publishMerkleDistributorBlocks();
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

  public async publishMerkleDistributorBlocks() {
    const chainId = this.appConfig.values.web3.merkleDistributor.chainId;
    const configStartBlockNumber = this.appConfig.values.web3.merkleDistributor.startBlockNumber;
    const provider = this.providers.getProvider(chainId);
    const latestBlock = await provider.getBlock("latest");
    let previousProcessedBlock = await this.merkleDistributorProcessedBlockRepository.findOne({
      where: { chainId },
    });

    const blockRange = this.determineBlockRange(
      chainId,
      latestBlock.number,
      configStartBlockNumber,
      previousProcessedBlock?.latestBlock,
    );

    if (!blockRange) {
      return;
    }

    if (!previousProcessedBlock) {
      previousProcessedBlock = this.merkleDistributorProcessedBlockRepository.create({
        chainId,
        latestBlock: blockRange.to,
      });
    } else {
      previousProcessedBlock.latestBlock = blockRange.to;
    }
    await this.merkleDistributorProcessedBlockRepository.save(previousProcessedBlock);

    await this.scraperQueuesService.publishMessage<MerkleDistributorBlocksEventsQueueMessage>(
      ScraperQueue.MerkleDistributorBlocksEvents,
      {
        chainId,
        ...blockRange,
      },
    );
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

    for (const chainIdStr of Object.keys(latestBlocks)) {
      const chainId = parseInt(chainIdStr);
      let previousProcessedBlock = await this.processedBlockRepository.findOne({
        where: { chainId },
      });
      const configStartBlockNumber = this.appConfig.values.web3.spokePoolContracts[chainId].startBlockNumber;

      const blockRange = this.determineBlockRange(
        chainId,
        latestBlocks[chainId],
        configStartBlockNumber,
        previousProcessedBlock?.latestBlock,
      );

      if (!blockRange) {
        continue;
      }

      if (!previousProcessedBlock) {
        previousProcessedBlock = this.processedBlockRepository.create({
          chainId,
          latestBlock: blockRange.to,
        });
      } else {
        previousProcessedBlock.latestBlock = blockRange.to;
      }
      await this.processedBlockRepository.save(previousProcessedBlock);
    }

    return blockRanges;
  }

  public determineBlockRange(
    chainId: number,
    latestBlockNumber: number,
    configStartBlockNumber: number,
    previousProcessedBlockNumber?: number,
  ) {
    let from = 1;

    if (previousProcessedBlockNumber) {
      from = previousProcessedBlockNumber + 1;
    } else if (configStartBlockNumber) {
      from = configStartBlockNumber;
    }

    const to = Math.min(latestBlockNumber - this.getFollowingDistance(chainId), from + this.getMinBlockRange(chainId));

    if (from < to) {
      return { from, to };
    }
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

    return 3;
  }
}
