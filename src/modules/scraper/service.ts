import { Injectable, Logger } from "@nestjs/common";
import { EthProvidersService } from "../web3/services/EthProvidersService";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ChainIds } from "../web3/model/ChainId";
import { AppConfig } from "../configuration/configuration.service";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { MerkleDistributorProcessedBlock } from "./model/MerkleDistributorProcessedBlock.entity";
import { ScraperQueuesService } from "./service/ScraperQueuesService";
import {
  BlockNumberQueueMessage,
  BlocksEventsQueueMessage,
  DepositFilledDateQueueMessage,
  DepositReferralQueueMessage,
  FeeBreakdownQueueMessage,
  MerkleDistributorBlocksEventsQueueMessage,
  ScraperQueue,
} from "./adapter/messaging";
import { wait } from "../../utils";
import {
  BackfillDepositorAddressBody,
  BackfillFeeBreakdownBody,
  BackfillFilledDateBody,
  RetryIncompleteDepositsBody,
  SubmitReindexReferralAddressJobBody,
} from "./entry-point/http/dto";
import { Deposit } from "../deposit/model/deposit.entity";

const SPOKE_POOL_VERIFIER_CONTRACT_ADDRESS = "0x269727F088F16E1Aea52Cf5a97B1CD41DAA3f02D";

@Injectable()
export class ScraperService {
  private logger = new Logger(ScraperService.name);

  public constructor(
    private providers: EthProvidersService,
    private appConfig: AppConfig,
    @InjectRepository(ProcessedBlock)
    private processedBlockRepository: Repository<ProcessedBlock>,
    @InjectRepository(Deposit)
    private depositRepository: Repository<Deposit>,
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
      this.publishMerkleDistributorBlocksV2(30);
    }
  }

  public async publishBlocks(chainId: number, secondsInterval: number) {
    while (true) {
      try {
        const blockNumber = await this.providers.getProvider(chainId).getBlockNumber();
        this.logger.log(`latest block chainId: ${chainId} ${blockNumber}`);
        const spokePoolContracts = this.appConfig.values.web3.spokePoolContracts[chainId] || [];

        if (spokePoolContracts.length === 0) return;

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
            { delay: 5000 * 60 },
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

  public async publishMerkleDistributorBlocksV2(interval: number) {
    while (true) {
      try {
        const chainId = this.appConfig.values.web3.merkleDistributorContracts.opRewards.chainId;
        const blockNumber = await this.providers.getProvider(chainId).getBlockNumber();
        const configStartBlockNumber = this.appConfig.values.web3.merkleDistributorContracts.opRewards.blockNumber;
        const range = await this.determineBlockRange(
          chainId,
          blockNumber,
          configStartBlockNumber,
          this.merkleDistributorProcessedBlockRepository,
        );

        if (!!range) {
          const queueMsg = { chainId, ...range };
          await this.scraperQueuesService.publishMessage<MerkleDistributorBlocksEventsQueueMessage>(
            ScraperQueue.MerkleDistributorBlocksEventsV2,
            queueMsg,
          );
          // publish the block range again to be processed with delay
          await this.scraperQueuesService.publishMessage<MerkleDistributorBlocksEventsQueueMessage>(
            ScraperQueue.MerkleDistributorBlocksEventsV2,
            queueMsg,
            { delay: 1000 * 60 * 3 },
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

    return 10;
  }

  public async retryIncompleteDeposits(body: RetryIncompleteDepositsBody) {
    const deposits = await this.depositRepository
      .createQueryBuilder("d")
      .where("d.depositDate is null")
      .orWhere("d.priceId is null")
      .orWhere("d.tokenId is null")
      .orWhere("d.acxUsdPrice is null")
      .orderBy("d.id", "ASC")
      .take(body.count || undefined)
      .getMany();
    this.logger.log(`[retryIncompleteDeposits] found ${deposits.length} deposits`);

    for (const deposit of deposits) {
      this.logger.log(`[retryIncompleteDeposits] publish deposit ${deposit.id} on BlockNumber queue`);
      await this.scraperQueuesService.publishMessage<BlockNumberQueueMessage>(ScraperQueue.BlockNumber, {
        depositId: deposit.id,
      });
    }
  }

  public async reindexReferralAddress(data: SubmitReindexReferralAddressJobBody) {
    const { fromDate, toDate } = data;
    let page = 0;
    const limit = 1000;
    while (true) {
      // Make paginated SQL queries to get all deposits without a referral address and made after the processed deposit
      const deposits = await this.depositRepository
        .createQueryBuilder("d")
        .where("d.depositDate >= :fromDate", { fromDate })
        .andWhere("d.depositDate <= :toDate", { toDate })
        .orderBy("d.depositDate", "ASC")
        .take(limit)
        .skip(page * limit)
        .getMany();

      const messages: DepositReferralQueueMessage[] = deposits.map((d) => ({
        depositId: d.id,
        rectifyStickyReferralAddress: false,
      }));
      this.logger.debug(
        `publish ${deposits.length} deposits from ${deposits[0].depositDate} to ${
          deposits[deposits.length - 1]
        } to DepositReferralQueue`,
      );
      await this.scraperQueuesService.publishMessagesBulk<DepositReferralQueueMessage>(
        ScraperQueue.DepositReferral,
        messages,
      );

      // if the length of the returned deposits is lower than the limit, we processed all depositor's deposits,
      // else go to the next page
      if (deposits.length < limit) {
        break;
      } else {
        page = page + 1;
      }
    }
  }

  public async backfillFeeBreakdown(body: BackfillFeeBreakdownBody) {
    const deposits = await this.depositRepository
      .createQueryBuilder("d")
      .where(`d."feeBreakdown"::text='{}'`)
      .andWhere("d.priceId is not null")
      .andWhere("d.tokenId is not null")
      .andWhere("d.depositDate is not null")
      .andWhere("d.status = :status", { status: "filled" })
      .orderBy("d.id", "DESC")
      .take(body.count || 1000)
      .getMany();
    this.logger.debug(`[backfillFeeBreakdown] found ${deposits.length} deposits`);

    for (const deposit of deposits) {
      await this.scraperQueuesService.publishMessage<FeeBreakdownQueueMessage>(ScraperQueue.FeeBreakdown, {
        depositId: deposit.id,
      });
    }
  }

  public async backfillFilledDate(body: BackfillFilledDateBody) {
    const deposits = await this.depositRepository
      .createQueryBuilder("d")
      .andWhere("d.filledDate is null")
      .andWhere("d.status='filled'")
      .andWhere("d.depositDate is not null")
      .orderBy("d.id", "DESC")
      .take(body.count || 1000)
      .getMany();
    this.logger.debug(`[backfillFilledDate] found ${deposits.length} deposits`);

    for (const deposit of deposits) {
      await this.scraperQueuesService.publishMessage<DepositFilledDateQueueMessage>(ScraperQueue.DepositFilledDate, {
        depositId: deposit.id,
      });
    }
  }

  public async backfillDepositorAddress(body: BackfillDepositorAddressBody) {
    const depositorAddress = SPOKE_POOL_VERIFIER_CONTRACT_ADDRESS;
    const query = this.depositRepository
      .createQueryBuilder("d")
      .where("d.depositorAddress = :depositorAddress", { depositorAddress })
      .orderBy("d.depositDate", "ASC")
      .take(body.count || 1000);

    if (body.fromDate) {
      query.andWhere("d.depositDate >= :fromDate", { fromDate: body.fromDate });
    }

    const deposits = await query.getMany();

    for (const deposit of deposits) {
      const receipt = await this.providers.getCachedTransactionReceipt(deposit.sourceChainId, deposit.depositTxHash);
      await this.depositRepository.update({ id: deposit.id }, { depositorAddr: receipt.from });
    }

    return {
      deposits: deposits.length,
    };
  }
}
