import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Job, JobCounts, JobOptions, Queue } from "bull";
import { ScraperQueue } from "../adapter/messaging";
import { RetryFailedJobsBody } from "../entry-point/http/dto";

@Injectable()
export class ScraperQueuesService {
  private logger = new Logger(ScraperQueuesService.name);
  private queuesMap: Record<ScraperQueue, Queue>;

  public constructor(
    @InjectQueue(ScraperQueue.BlocksEvents) private blocksEventsQueue: Queue,
    @InjectQueue(ScraperQueue.MerkleDistributorBlocksEvents) private merkleDistributorBlocksEventsQueue: Queue,
    @InjectQueue(ScraperQueue.MerkleDistributorBlocksEventsV2) private merkleDistributorBlocksEventsV2Queue: Queue,
    @InjectQueue(ScraperQueue.FillEvents) private fillEventsQueue: Queue,
    @InjectQueue(ScraperQueue.FillEvents2) private fillEventsQueue2: Queue,
    @InjectQueue(ScraperQueue.FillEventsV3) private fillEventsV3Queue: Queue,
    @InjectQueue(ScraperQueue.SpeedUpEvents) private speedUpEventsQueue: Queue,
    @InjectQueue(ScraperQueue.SpeedUpEventsV3) private speedUpEventsV3Queue: Queue,
    @InjectQueue(ScraperQueue.BlockNumber) private blockNumberQueue: Queue,
    @InjectQueue(ScraperQueue.TokenDetails) private tokenDetailsQueue: Queue,
    @InjectQueue(ScraperQueue.TokenPrice) private tokenPriceQueue: Queue,
    @InjectQueue(ScraperQueue.DepositFilledDate) private depositFilledDateQueue: Queue,
    @InjectQueue(ScraperQueue.DepositAcxPrice) private depositAcxPriceQueue: Queue,
    @InjectQueue(ScraperQueue.SuggestedFees) private suggestedFeesQueue: Queue,
    @InjectQueue(ScraperQueue.TrackFillEvent) private trackFillEventsQueue: Queue,
    @InjectQueue(ScraperQueue.FeeBreakdown) private feeBreakdownsQueue: Queue,
    @InjectQueue(ScraperQueue.OpRebateReward) private opRebateRewardsQueue: Queue,
    @InjectQueue(ScraperQueue.ArbRebateReward) private arbRebateRewardQueue: Queue,
    @InjectQueue(ScraperQueue.MerkleDistributorClaim) private merkleDistributorClaimQueue: Queue,
    @InjectQueue(ScraperQueue.FindMissedFillEvent) private findMissedFillEventQueue: Queue,
  ) {
    this.queuesMap = {
      [ScraperQueue.BlocksEvents]: this.blocksEventsQueue,
      [ScraperQueue.MerkleDistributorBlocksEvents]: this.merkleDistributorBlocksEventsQueue,
      [ScraperQueue.MerkleDistributorBlocksEventsV2]: this.merkleDistributorBlocksEventsV2Queue,
      [ScraperQueue.FillEvents]: this.fillEventsQueue,
      [ScraperQueue.FillEvents2]: this.fillEventsQueue2,
      [ScraperQueue.FillEventsV3]: this.fillEventsV3Queue,
      [ScraperQueue.SpeedUpEvents]: this.speedUpEventsQueue,
      [ScraperQueue.SpeedUpEventsV3]: this.speedUpEventsV3Queue,
      [ScraperQueue.BlockNumber]: this.blockNumberQueue,
      [ScraperQueue.TokenDetails]: this.tokenDetailsQueue,
      [ScraperQueue.TokenPrice]: this.tokenPriceQueue,
      [ScraperQueue.DepositFilledDate]: this.depositFilledDateQueue,
      [ScraperQueue.DepositAcxPrice]: this.depositAcxPriceQueue,
      [ScraperQueue.SuggestedFees]: this.suggestedFeesQueue,
      [ScraperQueue.TrackFillEvent]: this.trackFillEventsQueue,
      [ScraperQueue.FeeBreakdown]: this.feeBreakdownsQueue,
      [ScraperQueue.OpRebateReward]: this.opRebateRewardsQueue,
      [ScraperQueue.ArbRebateReward]: this.arbRebateRewardQueue,
      [ScraperQueue.MerkleDistributorClaim]: this.merkleDistributorClaimQueue,
      [ScraperQueue.FindMissedFillEvent]: this.findMissedFillEventQueue,
    };
  }

  public async publishMessage<T>(queue: ScraperQueue, message: T, options: JobOptions = {}) {
    const q = this.queuesMap[queue];

    if (q) {
      await q.add(message, options);
    }
  }

  public async publishMessagesBulk<T>(queue: ScraperQueue, messages: T[]) {
    const q = this.queuesMap[queue];

    if (q) {
      await q.addBulk(messages.map((m) => ({ data: m })));
    }
  }

  async getJobCounts() {
    const result = {};

    for (const queueName of Object.keys(this.queuesMap)) {
      const queue = this.queuesMap[queueName] as Queue;
      const jobCounts = await queue.getJobCounts();
      result[queueName] = jobCounts;
    }

    return result as Record<ScraperQueue, JobCounts>;
  }

  public async retryFailedJobs(body: RetryFailedJobsBody) {
    const q = this.queuesMap[body.queue];

    if (!q) return;

    try {
      let failedJobs: Job[] = [];
      if (body.count > 0) {
        failedJobs = await q.getFailed(0, body.count);
      } else {
        failedJobs = await q.getFailed();
      }
      // from whatever reason, the list can contain null values :|
      failedJobs = failedJobs.filter((job) => !!job);

      for (const failedJob of failedJobs) {
        await failedJob.retry().catch((error) => {
          this.logger.error(error);
        });
      }
    } catch (error) {
      this.logger.error(error);
    }
  }
}
