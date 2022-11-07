import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";
import {
  BlocksEventsQueueMessage,
  MerkleDistributorBlocksEventsQueueMessage,
  DepositFilledDateQueueMessage,
  DepositReferralQueueMessage,
  ScraperQueue,
  TokenPriceQueueMessage,
} from "../../adapter/messaging";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { SubmitReferralAddressJobBody, ProcessBlocksBody, ProcessPricesBody, SubmitDepositFilledDateBody } from "./dto";

@Controller()
export class ScraperController {
  constructor(private scraperQueuesService: ScraperQueuesService) {}

  @Post("scraper/blocks")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async processBlocks(@Req() req: Request, @Body() body: ProcessBlocksBody) {
    const { chainId, from, to } = body;
    await this.scraperQueuesService.publishMessage<BlocksEventsQueueMessage>(ScraperQueue.BlocksEvents, {
      chainId,
      from,
      to,
    });
  }

  @Post("scraper/blocks/merkle-distributor")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async processMerkleDistributorBlocks(@Req() req: Request, @Body() body: ProcessBlocksBody) {
    const { chainId, from, to } = body;
    await this.scraperQueuesService.publishMessage<MerkleDistributorBlocksEventsQueueMessage>(
      ScraperQueue.MerkleDistributorBlocksEvents,
      {
        chainId,
        from,
        to,
      },
    );
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

  @Post("scraper/deposit-filled-date")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitDepositFilledDateJob(@Body() body: SubmitDepositFilledDateBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<DepositFilledDateQueueMessage>(ScraperQueue.DepositFilledDate, {
        depositId,
      });
    }
  }
}
