import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";
import {
  BlockNumberQueueMessage,
  BlocksEventsQueueMessage,
  MerkleDistributorBlocksEventsQueueMessage,
  DepositFilledDateQueueMessage,
  DepositReferralQueueMessage,
  ScraperQueue,
  TokenPriceQueueMessage,
  TokenDetailsQueueMessage,
  DepositAcxPriceQueueMessage,
  SuggestedFeesQueueMessage,
} from "../../adapter/messaging";
import { ScraperService } from "../../service";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import {
  SubmitReferralAddressJobBody,
  ProcessBlocksBody,
  ProcessPricesBody,
  SubmitDepositFilledDateBody,
  ProcessBlockNumberBody,
  SubmitDepositAcxPriceBody,
  SubmitSuggestedFeesBody,
  RetryFailedJobsBody,
  RetryIncompleteDepositsBody,
  SubmitReindexReferralAddressJobBody,
} from "./dto";

@Controller()
export class ScraperController {
  constructor(private scraperQueuesService: ScraperQueuesService, private scraperService: ScraperService) {}

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

  @Post("scraper/block-number")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitBlockNumberJobs(@Body() body: ProcessBlockNumberBody) {
    const { fromDepositId, toDepositId } = body;
    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<BlockNumberQueueMessage>(ScraperQueue.BlockNumber, {
        depositId,
      });
    }
  }

  @Post("scraper/prices")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("scraper")
  async submitPricesJobs(@Body() body: ProcessPricesBody) {
    const { fromDepositId, toDepositId } = body;
    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<TokenPriceQueueMessage>(ScraperQueue.TokenPrice, {
        depositId,
      });
    }
  }

  @Post("scraper/token-details")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitTokenDetailsJobs(@Body() body: ProcessPricesBody) {
    const { fromDepositId, toDepositId } = body;
    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<TokenDetailsQueueMessage>(ScraperQueue.TokenDetails, {
        depositId,
      });
    }
  }

  @Post("scraper/referral-address")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("scraper")
  async submitReferralAddressJob(@Body() body: SubmitReferralAddressJobBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<DepositReferralQueueMessage>(ScraperQueue.DepositReferral, {
        depositId,
      });
    }
  }

  @Post("scraper/referral-address-reindex")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("scraper")
  async submitReindexReferralAddressJob(@Body() body: SubmitReindexReferralAddressJobBody) {
    await this.scraperService.reindexReferralAddress(body);
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

  @Post("scraper/deposit-acx-price")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitDepositAcxPriceJob(@Body() body: SubmitDepositAcxPriceBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<DepositAcxPriceQueueMessage>(ScraperQueue.DepositAcxPrice, {
        depositId,
      });
    }
  }

  @Post("scraper/suggested-fees")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitSuggestedFeesJob(@Body() body: SubmitSuggestedFeesBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<SuggestedFeesQueueMessage>(ScraperQueue.SuggestedFees, {
        depositId,
      });
    }
  }

  @Post("scraper/failed-jobs/retry")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async retryFailedJobs(@Body() body: RetryFailedJobsBody) {
    await this.scraperQueuesService.retryFailedJobs(body);
  }

  @Post("scraper/incomplete-deposits/retry")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async retryIncompleteDeposits(@Body() body: RetryIncompleteDepositsBody) {
    await this.scraperService.retryIncompleteDeposits(body);
  }
}
