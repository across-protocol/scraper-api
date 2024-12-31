import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";

import { OpRebateRewardV2Message, ScraperQueue } from ".";
import { OpRebateServiceV2 } from "../../../rewards/services/opRebateServiceV2";

@Processor(ScraperQueue.OpRebateRewardV2)
export class OpRebateRewardConsumerV2 {
  private logger = new Logger(OpRebateRewardConsumerV2.name);

  constructor(
    private opRebateService: OpRebateServiceV2,
  ) {}

  @Process()
  private async process(job: Job<OpRebateRewardV2Message>) {
    console.log("Processing msg");
    const { depositId, originChainId } = job.data;
    await this.opRebateService.createOpRebatesForDeposit(depositId, originChainId);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${JSON.stringify(job.data)} failed: ${error}`);
  }
}
