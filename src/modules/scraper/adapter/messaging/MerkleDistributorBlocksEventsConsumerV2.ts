import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { utils } from "ethers";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { MerkleDistributorBlocksEventsQueueMessage, MerkleDistributorClaimQueueMessage, ScraperQueue } from ".";
import { ClaimedEvent } from "@across-protocol/contracts-v2/dist/typechain/MerkleDistributor";
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
  ) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<MerkleDistributorBlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const address = this.appConfig.values.web3.merkleDistributorContracts.opRewards.address;
    const claimedEvents = (await this.providers
      .getMerkleDistributorQuerier(chainId, address)
      .getClaimedEvents(from, to)) as ClaimedEvent[];
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${claimedEvents.length} ClaimedEvent`);

    for (const event of claimedEvents) {
      try {
        const claim = await this.fromClaimedEventToMerkleDistributorClaim(event, chainId, address);
        await this.merkleDistributorClaimRepository.insert(claim);
        this.scraperQueuesService.publishMessage<MerkleDistributorClaimQueueMessage>(
          ScraperQueue.MerkleDistributorClaim,
          {
            claimId: claim.id,
          },
        );
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          // Ignore duplicate key value violates unique constraint error.
          this.logger.warn(error);
        } else {
          throw error;
        }
      }
    }
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
