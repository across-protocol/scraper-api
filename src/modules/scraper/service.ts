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
    if (this.appConfig.values.enableSpokePoolsEventsProcessing) {
      for (const chainId of this.appConfig.values.spokePoolsEventsProcessingChainIds) {
        this.publishBlocks(chainId, this.getSecondsInterval(chainId));
      }
    }

    if (this.appConfig.values.enableMerkleDistributorEventsProcessing) {
      this.publishMerkleDistributorBlocks(30);
    }
  }

  public async publishBlocks(chainId: number, secondsInterval: number) {
    while (true) {
      try {
        const blockNumber = await this.providers.getProvider(chainId).getBlockNumber();
        this.logger.log(`latest block chainId: ${chainId} ${blockNumber}`);
        const defaultStartBlockNumber = Math.min(
          ...this.appConfig.values.web3.spokePoolContracts[chainId].map((contract) => contract.startBlockNumber),
        );
        const range = await this.determineBlockRange(
          chainId,
          blockNumber,
          defaultStartBlockNumber,
          this.processedBlockRepository,
        );
        if (!!range) {
          const queueMsg = { chainId, ...range };
          await this.scraperQueuesService.publishMessage<BlocksEventsQueueMessage>(ScraperQueue.BlocksEvents, queueMsg);
          // publish the block range again to be processed with a delay of 60 seconds
          await this.scraperQueuesService.publishMessage<BlocksEventsQueueMessage>(
            ScraperQueue.BlocksEvents,
            queueMsg,
            { delay: 1000 * 60 },
          );
          this.logger.log(`publish chainId: ${chainId} from: ${range.from} to: ${range.to}`);
        }
      } catch (error) {
        this.logger.error(error);
      }
      await wait(secondsInterval);
    }
  }

  public async publishMerkleDistributorBlocks(interval: number) {
    while (true) {
      try {
        const chainId = this.appConfig.values.web3.merkleDistributor.chainId;
        const blockNumber = await this.providers.getProvider(chainId).getBlockNumber();
        const configStartBlockNumber = this.appConfig.values.web3.merkleDistributor.startBlockNumber;
        const range = await this.determineBlockRange(
          chainId,
          blockNumber,
          configStartBlockNumber,
          this.merkleDistributorProcessedBlockRepository,
          true,
        );

        if (!!range) {
          const queueMsg = { chainId, ...range };
          await this.scraperQueuesService.publishMessage<MerkleDistributorBlocksEventsQueueMessage>(
            ScraperQueue.MerkleDistributorBlocksEvents,
            queueMsg,
          );
        }
      } catch (error) {
        this.logger.error(error);
      }
      await wait(interval);
    }
  }

  /**
   * Compute the start and the end of the next batch of blocks that needs to be processed.
   * `from` is computed depending on the latest block saved in DB || start block number defined in config file || 1
   * `to` is a block number up to the latest block number from chain, but capped at a max value to avoid huge block ranges
   * @returns the block range or undefined if from > to
   */
  public async determineBlockRange(
    chainId: number,
    latestBlockNumber: number,
    startBlockNumber: number,
    blockRepository: Repository<ProcessedBlock | MerkleDistributorProcessedBlock>,
    keepDistanceFromHead = false,
  ) {
    let previousProcessedBlock = await blockRepository.findOne({
      where: { chainId },
    });
    let from = 1;
    if (previousProcessedBlock) {
      from = previousProcessedBlock.latestBlock + 1;
    } else if (startBlockNumber) {
      from = startBlockNumber;
    }
    const distanceFromHead = keepDistanceFromHead ? this.getFollowingDistance(chainId) : 0;
    const to = Math.min(latestBlockNumber - distanceFromHead, from + this.getMinBlockRange(chainId));

    if (from > to) {
      return undefined;
    }

    if (!previousProcessedBlock) {
      previousProcessedBlock = blockRepository.create({
        chainId,
        latestBlock: to,
      });
    } else {
      previousProcessedBlock.latestBlock = to;
    }
    await blockRepository.save(previousProcessedBlock);

    return { from, to };
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

  /**
   * Get seconds interval used to query the contract events based on the chain's block time
   * @param chainId the chain id
   * @returns the number of seconds
   */
  private getSecondsInterval(chainId: number): number {
    if (chainId === ChainIds.mainnet) {
      return 10;
    }
    if (chainId === ChainIds.arbitrum) {
      return 10;
    }
    if (chainId === ChainIds.optimism) {
      return 10;
    }
    if (chainId === ChainIds.polygon) {
      return 10;
    }
  }
}
