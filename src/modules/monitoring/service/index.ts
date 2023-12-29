import { Injectable, Logger } from "@nestjs/common";
import { SlackService } from "../adapter/slack/service";
import { AppConfig } from "../../configuration/configuration.service";

@Injectable()
export class MonitoringService {
  private logger = new Logger(MonitoringService.name);

  constructor(private slackService: SlackService, private appConfig: AppConfig) {}

  public async postSlackMessage(payload: any) {
    const { enabled, webhookUrl } = this.appConfig.values.slack;

    if (!enabled) {
      this.logger.log("Posting messages to Slack is disabled");
      return;
    }

    return this.slackService.postMessage(webhookUrl, payload);
  }
}
