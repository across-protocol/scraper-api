import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import {
  BlocksEventsQueueMessage,
  DepositReferralQueueMessage,
  ScraperQueue,
  TokenPriceQueueMessage,
} from "../../adapter/messaging";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { SubmitReferralAddressJobBody, ProcessBlocksBody, ProcessPricesBody } from "./dto";

@Controller()
export class ScraperController {
  constructor(private scraperQueuesService: ScraperQueuesService) {}

  @Post("scraper/blocks")
  @ApiTags("scraper")
  async processBlocks(@Req() req: Request, @Body() body: ProcessBlocksBody) {
    const { chainId, from, to } = body;
    await this.scraperQueuesService.publishMessage<BlocksEventsQueueMessage>(ScraperQueue.BlocksEvents, {
      chainId,
      from,
      to,
    });
  }

  @Post("scraper/prices")
  @ApiTags("scraper")
  async submitPricesJobs(@Body() body: ProcessPricesBody) {
    const { fromDepositId, toDepositId } = body;
    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<TokenPriceQueueMessage>(ScraperQueue.TokenPrice, {
        depositId,
      });
    }
  }

  @Post("scraper/referral-address")
  @ApiTags("scraper")
  async submitReferralAddressJob(@Body() body: SubmitReferralAddressJobBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<DepositReferralQueueMessage>(ScraperQueue.DepositReferral, {
        depositId,
      });
    }
  }
}
