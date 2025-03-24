import { Injectable, Logger } from "@nestjs/common";
import { CronExpression } from "@nestjs/schedule";
import { DateTime } from "luxon";

import { EnhancedCron } from "../../../utils";
import { InjectRepository } from "@nestjs/typeorm";
import { QueueJobCount } from "../model/QueueJobCount.entity";
import { Repository } from "typeorm";
import { MonitoringService } from "../../monitoring/service";

@Injectable()
export class SlackReportingCron {
  private logger = new Logger(SlackReportingCron.name);
  private semaphore = false;

  constructor(
    @InjectRepository(QueueJobCount) private queueJobCountRepository: Repository<QueueJobCount>,
    private monitoringService: MonitoringService,
  ) {}

  @EnhancedCron(CronExpression.EVERY_10_MINUTES)
  async startCron() {
    try {
      if (this.semaphore) return;
      this.semaphore = true;

      await this.sendSlackMessage();

      this.semaphore = false;
    } catch (error) {
      this.semaphore = false;
      this.logger.error(error);
    }
  }

  private async sendSlackMessage() {
    const result = await this.queueJobCountRepository
      .createQueryBuilder("qjc")
      .select("MAX(qjc.date)", "max")
      .getRawOne();
    const maxDate = result["max"] as Date;
    if (!maxDate) return;

    const jobCounts = await this.queueJobCountRepository.find({ where: { date: maxDate }, order: { id: "ASC" } });
    let postToSlack = false;

    for (const jobCount of jobCounts) {
      const { active, completed, delayed, failed, paused, waiting } = jobCount;
      const aboveThreshold = [active, completed, delayed, failed, paused, waiting].some((count) => count >= 200);
      if (aboveThreshold) postToSlack = true;
    }

    if (!postToSlack) return;

    const message = this.formatSlackMessage(maxDate, jobCounts);
    await this.monitoringService.postSlackMessage(message);
  }

  private formatJobCount(count: number) {
    if (count < 100) {
      return count.toString();
    }

    return `\`${count}\``;
  }

  private formatSlackMessage(date: Date, jobCounts: QueueJobCount[]) {
    const formattedDate = DateTime.fromJSDate(date).toFormat("yyyy-LL-dd HH:mm:ss");
    let text = "";

    for (const jobCount of jobCounts) {
      const { active, completed, delayed, failed, waiting, paused, queueName } = jobCount;
      text += `*${queueName}* \n :hourglass_flowing_sand: ${this.formatJobCount(
        waiting,
      )}\t :rocket: ${this.formatJobCount(active)}\t :x: ${this.formatJobCount(
        failed,
      )}\t :clock3: ${this.formatJobCount(delayed)}\t :white_check_mark: ${this.formatJobCount(
        completed,
      )}\t :double_vertical_bar: ${this.formatJobCount(paused)} \n\n`;
    }

    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Jobs in the queues",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "_:warning: This messages was posted because some queues contains many messages and they require attention. See the stats below :point_down:_",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "_Legend:_\n_:hourglass_flowing_sand: waiting :rocket: active :x: failed :clock3: delayed :white_check_mark: completed :double_vertical_bar: paused_",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "plain_text",
              text: `:clock1: ${formattedDate}`,
              emoji: true,
            },
          ],
        },
        {
          type: "divider",
        },
      ],
    };

    return payload;
  }
}
