import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { MerkleDistributorBlocksEventsQueueMessage, ScraperQueue } from ".";
import { Claim } from "../../../airdrop/model/claim.entity";
import { utils } from "ethers";
import { ClaimedEvent } from "@across-protocol/contracts-v2/dist/typechain/contracts/merkle-distributor/AcrossMerkleDistributor";

@Processor(ScraperQueue.MerkleDistributorBlocksEvents)
export class MerkleDistributorBlocksEventsConsumer {
  private logger = new Logger(MerkleDistributorBlocksEventsConsumer.name);

  constructor(
    private providers: EthProvidersService,
    @InjectRepository(Claim) private claimRepository: Repository<Claim>,
  ) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<MerkleDistributorBlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const claimedEvents = (await this.providers
      .getMerkleDistributorQuerier()
      .getClaimedEvents(from, to)) as ClaimedEvent[];
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${claimedEvents.length} ClaimedEvent`);

    for (const event of claimedEvents) {
      try {
        const claim = await this.fromClaimedEventToClaim(event, chainId);
        await this.claimRepository.insert(claim);
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

  private async fromClaimedEventToClaim(event: ClaimedEvent, chainId: number) {
    const { blockNumber } = event;
    const { caller, accountIndex, windowIndex, account, rewardToken } = event.args;
    const blockTimestamp = (await this.providers.getCachedBlock(chainId, blockNumber)).date;

    return this.claimRepository.create({
      caller,
      accountIndex: accountIndex.toNumber(),
      windowIndex: windowIndex.toNumber(),
      account: utils.getAddress(account),
      rewardToken: utils.getAddress(rewardToken),
      blockNumber: blockNumber,
      claimedAt: blockTimestamp,
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.MerkleDistributorBlocksEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
