import { Injectable, Logger } from "@nestjs/common";
import { EthProvidersService } from "../web3/services/EthProvidersService";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { ChainIds } from "../web3/model/ChainId";
import { AppConfig } from "../configuration/configuration.service";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { MerkleDistributorProcessedBlock } from "./model/MerkleDistributorProcessedBlock.entity";
import { ScraperQueuesService } from "./service/ScraperQueuesService";
import {
  BlockNumberQueueMessage,
  BlocksEventsQueueMessage,
  DepositFilledDateQueueMessage,
  FeeBreakdownQueueMessage,
  HubPoolBlocksEventsQueueMessage,
  MerkleDistributorBlocksEventsQueueMessage,
  ScraperQueue,
} from "./adapter/messaging";
import { wait } from "../../utils";
import {
  BackfillDepositorAddressBody,
  BackfillFeeBreakdownBody,
  BackfillFilledDateBody,
  RetryIncompleteDepositsBody,
} from "./entry-point/http/dto";
import { Deposit } from "../deposit/model/deposit.entity";
import { HubPoolProcessedBlock } from "./model/HubPoolProcessedBlock.entity";

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
    @InjectRepository(HubPoolProcessedBlock)
    private hubPoolProcessedBlockRepository: Repository<HubPoolProcessedBlock>,
    private scraperQueuesService: ScraperQueuesService,
    private dataSource: DataSource,
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
      for (const rewardsType of Object.keys(this.appConfig.values.web3.merkleDistributorContracts)) {
        const merkleDistributorConfig = this.appConfig.values.web3.merkleDistributorContracts[rewardsType];
        this.publishMerkleDistributorBlocksV2(merkleDistributorConfig, 60);
      }
    }

    if (this.appConfig.values.enableHubPoolEventsProcessing) {
      this.publishHubPoolBlocks(30);
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
          true,
        );
        if (!!range) {
          const queueMsg = { chainId, ...range };
          await this.scraperQueuesService.publishMessage<BlocksEventsQueueMessage>(ScraperQueue.BlocksEvents, queueMsg);
          this.logger.log(`publish chainId: ${chainId} from: ${range.from} to: ${range.to}`);
        }
      } catch (error) {
        this.logger.error(error);
      }
      await wait(secondsInterval);
    }
  }

  public async publishMerkleDistributorBlocksV2(
    contractConfig: {chainId: number, address: string, blockNumber: number}, 
    interval: number,
  ) {
    while (true) {
      try {
        const chainId = contractConfig.chainId;
        const blockNumber = await this.providers.getProvider(chainId).getBlockNumber();
        const configStartBlockNumber = contractConfig.blockNumber;
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
            ScraperQueue.MerkleDistributorBlocksEventsV2,
            queueMsg,
          );
        }
      } catch (error) {
        this.logger.error(error);
      }
      await wait(interval);
    }
  }

  public async publishHubPoolBlocks(interval: number) {
    while (true) {
      try {
        const chainId = ChainIds.mainnet;
        const blockNumber = await this.providers.getProvider(chainId).getBlockNumber();
        const configStartBlockNumber = this.appConfig.values.web3.hubPoolContracts[chainId].startBlockNumber;
        const range = await this.determineBlockRange(
          chainId,
          blockNumber,
          configStartBlockNumber,
          this.hubPoolProcessedBlockRepository,
          true,
        );

        if (!!range) {
          const queueMsg = { chainId, ...range };
          await this.scraperQueuesService.publishMessage<HubPoolBlocksEventsQueueMessage>(
            ScraperQueue.HubPoolBlocksEvents,
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
    if (chainId === ChainIds.mainnet) {
      return 3;
    }

    if (chainId === ChainIds.polygon) {
      return 15;
    }

    if (chainId === ChainIds.arbitrum) {
      return 120;
    }

    if (chainId === ChainIds.zkSyncMainnet) {
      return 30;
    }

    if (chainId === ChainIds.linea) {
      return 15;
    }

    if (chainId === ChainIds.mode) {
      return 15;
    }

    if (chainId === ChainIds.lisk) {
      return 15;
    }

    if (chainId === ChainIds.optimism) {
      return 15;
    }

    if (chainId === ChainIds.zora) {
      return 15;
    }

    if (chainId === ChainIds.redstone) {
      return 15;
    }

    return 10;
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
      .where("d.depositorAddr = :depositorAddress", { depositorAddress })
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

  public async fixBridgeFee() {
    const deposits = await this.depositRepository.query(`
      select d.id
      from deposit d
      inner join token it on d."tokenId" = it.id
      inner join token ot on d."outputTokenId" = ot.id
      where (d."sourceChainId" = 81457 and it.symbol = 'USDB' and ot.symbol = 'DAI')
          or (d."destinationChainId" = 81457 and ot.symbol = 'USDB' and it.symbol = 'DAI');  
    `) as Pick<Deposit, "id">[];

    for (const deposit of deposits) {
      await this.scraperQueuesService.publishMessage<FeeBreakdownQueueMessage>(ScraperQueue.FeeBreakdown, {
        depositId: deposit.id,
      });
    }
  }
}
