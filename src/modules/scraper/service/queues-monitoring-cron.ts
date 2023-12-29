import { Injectable, Logger } from "@nestjs/common";
import { CronExpression } from "@nestjs/schedule";
import { JobCounts } from "bull";

import { EnhancedCron } from "../../../utils";
import { ScraperQueuesService } from "../../scraper/service/ScraperQueuesService";
import { InjectRepository } from "@nestjs/typeorm";
import { QueueJobCount } from "../../monitoring/model/QueueJobCount.entity";
import { Repository } from "typeorm";
import { ScraperQueue } from "../adapter/messaging";

@Injectable()
export class QueuesMonitoringCron {
  private logger = new Logger(QueuesMonitoringCron.name);
  private semaphore = false;

  constructor(
    @InjectRepository(QueueJobCount) private queueJobCountRepository: Repository<QueueJobCount>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @EnhancedCron(CronExpression.EVERY_MINUTE)
  async startCron() {
    try {
      if (this.semaphore) return;
      this.semaphore = true;

      const now = new Date();
      const jobCounts = await this.scraperQueuesService.getJobCounts();

      await this.insertToDatabase(jobCounts, now);
      this.printLogs(jobCounts);

      this.semaphore = false;
    } catch (error) {
      this.semaphore = false;
      this.logger.error(error);
    }
  }

  private printLogs(jobCounts: Record<ScraperQueue, JobCounts>) {
    let logString = "\nwaiting active completed failed delayed paused\n";
    for (const queueName of Object.keys(jobCounts)) {
      const { active, completed, delayed, failed, waiting } = jobCounts[queueName] as JobCounts;
      logString += `${waiting} ${active} ${completed} ${failed} ${delayed} ${jobCounts[queueName].paused} ${queueName} \n`;
    }
    this.logger.log(logString);
  }

  private async insertToDatabase(jobCounts: Record<ScraperQueue, JobCounts>, now: Date) {
    for (const queueName of Object.keys(jobCounts)) {
      const queueJobCounts = jobCounts[queueName as ScraperQueue];
      const { active, completed, delayed, failed, waiting } = queueJobCounts;
      await this.queueJobCountRepository.insert({
        queueName,
        waiting,
        active,
        failed,
        delayed,
        completed,
        paused: jobCounts[queueName].paused,
        date: now,
      });
    }
  }
}
