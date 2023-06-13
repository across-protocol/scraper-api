import { InjectQueue } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Job, JobOptions, Queue } from "bull";
import { ScraperQueue } from "../adapter/messaging";
import { RetryFailedJobsBody } from "../entry-point/http/dto";

@Injectable()
export class ScraperQueuesService {
  private logger = new Logger(ScraperQueuesService.name);
  private queuesMap: Record<ScraperQueue, Queue>;

  public constructor(
    @InjectQueue(ScraperQueue.BlocksEvents) private blocksEventsQueue: Queue,
    @InjectQueue(ScraperQueue.MerkleDistributorBlocksEvents) private merkleDistributorBlocksEventsQueue: Queue,
    @InjectQueue(ScraperQueue.FillEvents) private fillEventsQueue: Queue,
    @InjectQueue(ScraperQueue.FillEvents2) private fillEventsQueue2: Queue,
    @InjectQueue(ScraperQueue.SpeedUpEvents) private speedUpEventsQueue: Queue,
    @InjectQueue(ScraperQueue.BlockNumber) private blockNumberQueue: Queue,
    @InjectQueue(ScraperQueue.TokenDetails) private tokenDetailsQueue: Queue,
    @InjectQueue(ScraperQueue.DepositReferral) private depositReferralQueue: Queue,
    @InjectQueue(ScraperQueue.TokenPrice) private tokenPriceQueue: Queue,
    @InjectQueue(ScraperQueue.DepositFilledDate) private depositFilledDateQueue: Queue,
    @InjectQueue(ScraperQueue.DepositAcxPrice) private depositAcxPriceQueue: Queue,
    @InjectQueue(ScraperQueue.SuggestedFees) private suggestedFeesQueue: Queue,
    @InjectQueue(ScraperQueue.TrackFillEvent) private trackFillEventsQueue: Queue,
  ) {
    this.queuesMap = {
      [ScraperQueue.BlocksEvents]: this.blocksEventsQueue,
      [ScraperQueue.MerkleDistributorBlocksEvents]: this.merkleDistributorBlocksEventsQueue,
      [ScraperQueue.FillEvents]: this.fillEventsQueue,
      [ScraperQueue.FillEvents2]: this.fillEventsQueue2,
      [ScraperQueue.SpeedUpEvents]: this.speedUpEventsQueue,
      [ScraperQueue.BlockNumber]: this.blockNumberQueue,
      [ScraperQueue.TokenDetails]: this.tokenDetailsQueue,
      [ScraperQueue.DepositReferral]: this.depositReferralQueue,
      [ScraperQueue.TokenPrice]: this.tokenPriceQueue,
      [ScraperQueue.DepositFilledDate]: this.depositFilledDateQueue,
      [ScraperQueue.DepositAcxPrice]: this.depositAcxPriceQueue,
      [ScraperQueue.SuggestedFees]: this.suggestedFeesQueue,
      [ScraperQueue.TrackFillEvent]: this.trackFillEventsQueue,
    };
    this.initLogs();
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

  private initLogs() {
    setInterval(() => {
      for (const queueName of Object.keys(this.queuesMap)) {
        const queue = this.queuesMap[queueName] as Queue;
        queue
          .getJobCounts()
          .then((data) => this.logger.log(`${queueName} ${JSON.stringify(data)}`))
          .catch((data) => this.logger.error(`${queueName} ${JSON.stringify(data)}`));
      }
    }, 1000 * 60);
  }

  public async retryFailedJobs(body: RetryFailedJobsBody) {
    const q = this.queuesMap[body.queue];

    if (!q) return;

    try {
      let failedJobs: Job[] = [];
      if (body.count > 0) {
        await q.getFailed(0, body.count);
      } else {
        await q.getFailed();
      }
      
      for (const failedJob of failedJobs) {
        await failedJob.retry();
      }
    } catch (error) {
      this.logger.error(error);
    }
  }
}
