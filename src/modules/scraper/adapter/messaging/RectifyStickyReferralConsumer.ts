import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { MoreThan, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { DepositReferralQueueMessage, RectifyStickyReferralQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.RectifyStickyReferral)
export class RectifyStickyReferralConsumer {
  private logger = new Logger(RectifyStickyReferralConsumer.name);

  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<RectifyStickyReferralQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });

    if (!deposit) return;
    this.logger.debug(`deposit id: ${deposit.id} start`);
    // After extracting the referral address, all deposits with later deposit time must have
    // the sticky referral address updated
    const deposits = await this.depositRepository.find({
      where: {
        depositorAddr: deposit.depositorAddr,
        depositDate: MoreThan(deposit.depositDate),
      },
      order: {
        depositDate: "ASC",
      },
    });
    this.logger.debug(`deposit id: ${deposit.id} found ${deposits.length} deposits`);
    for (const d of deposits) {
      await this.scraperQueuesService.publishMessage<DepositReferralQueueMessage>(ScraperQueue.DepositReferral, {
        depositId: d.id,
        rectifyStickyReferralAddress: false,
      });
    }
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.RectifyStickyReferral} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
