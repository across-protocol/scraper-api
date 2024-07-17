import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { utils } from "ethers";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { MerkleDistributorBlocksEventsQueueMessage, MerkleDistributorClaimQueueMessage, ScraperQueue } from ".";
import { ClaimedEvent } from "@across-protocol/contracts-v2/dist/typechain/contracts/merkle-distributor/AcrossMerkleDistributor";
import { MerkleDistributorClaim } from "../../../airdrop/model/merkle-distributor-claim.entity";
import { AppConfig } from "../../../configuration/configuration.service";
import { MerkleDistributorWindow } from "../../../airdrop/model/merkle-distributor-window.entity";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.MerkleDistributorBlocksEventsV2)
export class MerkleDistributorBlocksEventsConsumerV2 {
  private logger = new Logger(MerkleDistributorBlocksEventsConsumerV2.name);

  constructor(
    private scraperQueuesService: ScraperQueuesService,
    private providers: EthProvidersService,
    @InjectRepository(MerkleDistributorClaim)
    private merkleDistributorClaimRepository: Repository<MerkleDistributorClaim>,
    @InjectRepository(MerkleDistributorWindow)
    private merkleDistributorWindowRepository: Repository<MerkleDistributorWindow>,
    private appConfig: AppConfig,
    private dataSource: DataSource,
  ) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<MerkleDistributorBlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const filteredDistributorContracts = this.getDistributorContractsForChainId(chainId);
    const claimEvents = await this.getClaimEvents(filteredDistributorContracts, from, to);
    this.logNumberOfEventsFound(claimEvents, from, to);
    const insertResults = await this.insertClaimEvents(chainId, claimEvents);
    const messages = insertResults.map((claim) => ({claimId: claim.id}))    
    this.scraperQueuesService.publishMessagesBulk<MerkleDistributorClaimQueueMessage>(
      ScraperQueue.MerkleDistributorClaim,
      messages,
    );
  }

  private logNumberOfEventsFound(claimEvents: Record<string, ClaimedEvent[]>, from: number, to: number) {
    for (const address of Object.keys(claimEvents)) {
      this.logger.log(`Found ${claimEvents[address].length} ClaimedEvents from block ${from} to ${to} for contract ${address}`);
    }
  }

  private getDistributorContractsForChainId(chainId: number) {
    const filteredContractConfigs: Record<string, { chainId: number, address: string, blockNumber: number }> = {};

    for (const [rewardsKey, contractConfig] of Object.entries(this.appConfig.values.web3.merkleDistributorContracts)) {
      if (contractConfig.chainId !== chainId) continue;
      filteredContractConfigs[rewardsKey] = contractConfig;
    }

    return filteredContractConfigs;
  }

  private async getClaimEvents(
    filteredContractConfigs: Record<string, { chainId: number, address: string, blockNumber: number }>, 
    from: number, 
    to: number,
  ) {
    const eventsDict: Record<string, ClaimedEvent[]> = {};
    for (const contractConfig of Object.values(filteredContractConfigs)) {
      const events = await this.providers.getMerkleDistributorQuerier(
        contractConfig.chainId, 
        contractConfig.address,
      ).getClaimedEvents(from, to) as ClaimedEvent[]
      eventsDict[contractConfig.address] = events;
  }

  return eventsDict;
}

private async insertClaimEvents(chainId: number, events: Record<string, ClaimedEvent[]> = {}) {
  const insertResults: {id: number}[] = [];

  for (const address of Object.keys(events)) {
    const contractEvents = events[address];
    const claims = await Promise.all(
      contractEvents.map((event) => this.fromClaimedEventToMerkleDistributorClaim(event, chainId, address))
    );
    const insertResult = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(MerkleDistributorClaim)
      .values(claims)
      .orIgnore()
      .execute();
    for (const identifier of insertResult.identifiers) {
      if (identifier && Number.isInteger(identifier.id)) {
        insertResults.push({ id: identifier.id });
      }
    }
  }

  return insertResults;
}

  private async fromClaimedEventToMerkleDistributorClaim(
    event: ClaimedEvent,
    chainId: number,
    contractAddress: string,
  ) {
    const { blockNumber } = event;
    const { caller, accountIndex, windowIndex, account, rewardToken } = event.args;
    const blockTimestamp = (await this.providers.getCachedBlock(chainId, blockNumber)).date;
    const window = await this.merkleDistributorWindowRepository.findOne({
      where: {
        chainId,
        contractAddress,
        windowIndex: windowIndex.toNumber(),
      },
    });

    return this.merkleDistributorClaimRepository.create({
      caller,
      accountIndex: accountIndex.toNumber(),
      windowIndex: windowIndex.toNumber(),
      account: utils.getAddress(account),
      rewardToken: utils.getAddress(rewardToken),
      blockNumber: blockNumber,
      claimedAt: blockTimestamp,
      contractAddress,
      merkleDistributorWindowId: window.id,
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.MerkleDistributorBlocksEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
