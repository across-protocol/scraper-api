import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { DepositReferralQueueMessage, ScraperQueue } from ".";
import { ReferralService } from "../../../referral/services/service";

@Processor(ScraperQueue.DepositReferral)
export class DepositReferralConsumer {
  private logger = new Logger(DepositReferralConsumer.name);

  constructor(private referralService: ReferralService) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<DepositReferralQueueMessage>) {
    const { depositId } = job.data;
    await this.referralService.extractReferralAddressAndComputeStickyReferralAddresses(depositId);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.DepositReferral} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
