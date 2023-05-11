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
    job;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.HubPoolExecutedRootBundleEvent} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
