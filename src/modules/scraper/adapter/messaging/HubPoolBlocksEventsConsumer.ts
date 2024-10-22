import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { DataSource } from "typeorm";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { HubPoolBlocksEventsQueueMessage, ScraperQueue } from ".";
import { AppConfig } from "../../../configuration/configuration.service";
import { SetPoolRebalanceRoute } from "../../../web3/model/hubpool-events";
import { SetPoolRebalanceRouteEvent } from "../../../web3/model/SetPoolRebalanceRouteEvent.entity";
import { ChainIds } from "../../../web3/model/ChainId";
import { Block } from "../../../web3/model/block.entity";

@Processor(ScraperQueue.HubPoolBlocksEvents)
export class HubPoolBlocksEventsConsumer {
  private logger = new Logger(HubPoolBlocksEventsConsumer.name);

  constructor(
    private providers: EthProvidersService,
    private appConfig: AppConfig,
    private dataSource: DataSource,
  ) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<HubPoolBlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const { address } = this.appConfig.values.web3.hubPoolContracts[chainId];
    const setPoolRebalanceRouteEvents = (await this.providers
      .getHubPoolEventQuerier(chainId, address)
      .getSetPoolRebalanceRouteEvents(from, to)) as SetPoolRebalanceRoute[];
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${setPoolRebalanceRouteEvents.length} SetPoolRebalanceRouteEvent`);
    const blocksByNumber: Record<number, Block> = {};

    for (const event of setPoolRebalanceRouteEvents) {
      const block = await this.providers.getCachedBlock(ChainIds.mainnet, event.blockNumber);
      blocksByNumber[event.blockNumber] = block;
    }

    if (setPoolRebalanceRouteEvents.length > 0) {
      for (const event of setPoolRebalanceRouteEvents) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(SetPoolRebalanceRouteEvent)
          .values({
            date: blocksByNumber[event.blockNumber].date,
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
