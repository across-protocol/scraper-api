import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { MerkleDistributorBlocksEventsQueueMessage, ScraperQueue } from ".";
import { MerkleDistributorClaim } from "../../../airdrop/model/merkle-distributor-claim.entity";
import { AppConfig } from "../../../configuration/configuration.service";
import { MerkleDistributorWindow } from "../../../airdrop/model/merkle-distributor-window.entity";
import { SetPoolRebalanceRoute } from "../../../web3/model/hubpool-events";
import { SetPoolRebalanceRouteEvent } from "../../../web3/model/SetPoolRebalanceRouteEvent.entity";

@Processor(ScraperQueue.HubPoolBlocksEvents)
export class HubPoolBlocksEventsConsumer {
  private logger = new Logger(HubPoolBlocksEventsConsumer.name);

  constructor(
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
    const { address } = this.appConfig.values.web3.hubPoolContracts[chainId];
    const setPoolRebalanceRouteEvents = (await this.providers
      .getHubPoolEventQuerier(chainId, address)
      .getSetPoolRebalanceRouteEvents(from, to)) as SetPoolRebalanceRoute[];
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${setPoolRebalanceRouteEvents.length} SetPoolRebalanceRouteEvent`);

    if (setPoolRebalanceRouteEvents.length > 0) {
      for (const event of setPoolRebalanceRouteEvents) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(SetPoolRebalanceRouteEvent)
          .values({
            blockNumber: event.blockNumber,
            blockHash: event.blockHash,
            transactionIndex: event.transactionIndex,
            address: event.address,
            chainId,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex,
            destinationChainId: event.args.destinationChainId.toNumber(),
            l1Token: event.args.l1Token,
            destinationToken: event.args.destinationToken,
          })
          .orIgnore()
          .execute();
      }
    }
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${JSON.stringify(job.data)} failed: ${error}`);
  }
}
