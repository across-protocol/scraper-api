import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { MerkleDistributorClaimQueueMessage, ScraperQueue } from ".";
import { MerkleDistributorClaim } from "../../../airdrop/model/merkle-distributor-claim.entity";
import { AppConfig } from "../../../configuration/configuration.service";
import { MerkleDistributorWindow } from "../../../airdrop/model/merkle-distributor-window.entity";
import { OpReward } from "../../../rewards/model/op-reward.entity";
import { ArbReward } from "../../../rewards/model/arb-reward.entity";

@Processor(ScraperQueue.MerkleDistributorClaim)
export class MerkleDistributorClaimConsumer {
  private logger = new Logger(MerkleDistributorClaimConsumer.name);

  constructor(
    @InjectRepository(MerkleDistributorClaim)
    private merkleDistributorClaimRepository: Repository<MerkleDistributorClaim>,
    @InjectRepository(MerkleDistributorWindow)
    private merkleDistributorWindowRepository: Repository<MerkleDistributorWindow>,
    @InjectRepository(OpReward)
    private opRewardRepository: Repository<OpReward>,
    @InjectRepository(ArbReward)
    private arbRewardRepository: Repository<ArbReward>,
    private appConfig: AppConfig,
  ) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<MerkleDistributorClaimQueueMessage>) {
    const { claimId } = job.data;
    const claim = await this.merkleDistributorClaimRepository.findOne({
      where: { id: claimId },
    });

    if (!claim) {
      this.logger.log(`Claim with id: ${claimId} not found`);
      return;
    }

    const window = await this.merkleDistributorWindowRepository.findOne({
      where: { id: claim.merkleDistributorWindowId },
    });
    const merkleDistributorContracts = this.appConfig.values.web3.merkleDistributorContracts;

    if (window.contractAddress === merkleDistributorContracts.opRewards.address) {
      await this.opRewardRepository.update(
        {
          recipient: claim.account,
          windowIndex: window.windowIndex,
        },
        {
          isClaimed: true,
        },
      );
    } else if (window.contractAddress === merkleDistributorContracts.arbRewards.address) {
      await this.arbRewardRepository.update(
        {
          recipient: claim.account,
          windowIndex: window.windowIndex,
        },
        {
          isClaimed: true,
        },
      );
    } else {
      throw new Error(`Unkown rewards type for window with id: ${window.id}`);
    }
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${JSON.stringify(job.data)} failed: ${error}`);
  }
}
