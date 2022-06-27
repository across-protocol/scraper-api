import { Body, Controller, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { BlocksBatchQueueMessage, ScraperQueue } from "../../adapter/messaging";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { ProcessBlocksBody } from "./dto";

@Controller()
export class ScraperController {
  constructor(private scraperQueuesService: ScraperQueuesService) {}

  @Post("scraper/blocks")
  async processBlocks(@Req() req: Request, @Body() body: ProcessBlocksBody) {
    const { chainId, from, to } = body;
    await this.scraperQueuesService.publishMessage<BlocksBatchQueueMessage>(ScraperQueue.BlocksBatch, {
      chainId,
      from,
      to,
    });
  }
}
