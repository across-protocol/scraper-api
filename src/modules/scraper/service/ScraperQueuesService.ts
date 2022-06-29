import { InjectQueue } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { Queue } from "bull";
import { ScraperQueue } from "../adapter/messaging";

@Injectable()
export class ScraperQueuesService {
  public constructor(
    @InjectQueue(ScraperQueue.BlocksEvents) private blocksEventsQueue: Queue,
    @InjectQueue(ScraperQueue.FillEvents) private fillEventsQueue: Queue,
    @InjectQueue(ScraperQueue.BlockNumber) private blockNumberQueue: Queue,
    @InjectQueue(ScraperQueue.TokenDetails) private tokenDetailsQueue: Queue,
    @InjectQueue(ScraperQueue.DepositReferral) private depositReferralQueue: Queue,
  ) {
    
  }

  public async publishMessage<T>(queue: ScraperQueue, message: T) {
    if (queue === ScraperQueue.BlocksEvents) {
      await this.blocksEventsQueue.add(message);
    } else if (queue === ScraperQueue.FillEvents) {
      await this.fillEventsQueue.add(message);
    } else if (queue === ScraperQueue.BlockNumber) {
      await this.blockNumberQueue.add(message);
    } else if (queue === ScraperQueue.TokenDetails) {
      await this.tokenDetailsQueue.add(message);
    } else if (queue === ScraperQueue.DepositReferral) {
      await this.depositReferralQueue.add(message);
    }
  }

  public async publishMessagesBulk<T>(queue: ScraperQueue, messages: T[]) {
    if (queue === ScraperQueue.BlocksEvents) {
      await this.blocksEventsQueue.addBulk(messages.map((m) => ({ data: m })));
    } else if (queue === ScraperQueue.FillEvents) {
      await this.fillEventsQueue.addBulk(messages.map((m) => ({ data: m })));
    } else if (queue === ScraperQueue.BlockNumber) {
      await this.blockNumberQueue.addBulk(messages.map((m) => ({ data: m })));
    } else if (queue === ScraperQueue.TokenDetails) {
      await this.tokenDetailsQueue.addBulk(messages.map((m) => ({ data: m })));
    } else if (queue === ScraperQueue.DepositReferral) {
      await this.depositReferralQueue.addBulk(messages.map((m) => ({ data: m })));
    }
  }
}
