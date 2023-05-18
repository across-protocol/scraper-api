import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { HubPoolExecutedRootBundleEventQueueMessage, ScraperQueue } from ".";
import { Job } from "bull";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";

@Processor(ScraperQueue.HubPoolExecutedRootBundleEvent)
export class HubPoolExecutedRootBundleConsumer {
  private logger = new Logger(HubPoolExecutedRootBundleConsumer.name);

  constructor(private providers: EthProvidersService) {}

  @Process()
  private async process(job: Job<HubPoolExecutedRootBundleEventQueueMessage>) {
    const { to, from } = job.data;
    const hubPoolEventQuerier = this.providers.getHubPoolQuerier();
    const events = await hubPoolEventQuerier.getValidatedProposalEvents(from, to);
    this.logger.log(events);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.HubPoolExecutedRootBundleEvent} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
