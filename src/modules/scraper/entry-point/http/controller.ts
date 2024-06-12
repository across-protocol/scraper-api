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
  FeeBreakdownQueueMessage,
  OpRebateRewardMessage,
  ArbRebateRewardMessage,
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
  SubmitFeeBreakdownBody,
  OpRebateRewardBody,
  BackfillFeeBreakdownBody,
  BackfillFilledDateBody,
  BackfillDepositorAddressBody,
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

  @Post("scraper/blocks/merkle-distributor-v2")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async processMerkleDistributorBlocksV2(@Body() body: ProcessBlocksBody) {
    const { chainId, from, to } = body;
    await this.scraperQueuesService.publishMessage<MerkleDistributorBlocksEventsQueueMessage>(
      ScraperQueue.MerkleDistributorBlocksEventsV2,
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
        rectifyStickyReferralAddress: true,
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

  @Post("scraper/fee-breakdown")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitFeeBreakdownJob(@Body() body: SubmitFeeBreakdownBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<FeeBreakdownQueueMessage>(ScraperQueue.FeeBreakdown, {
        depositId,
      });
    }
  }

  @Post("scraper/op-rebate-reward")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitOpRebateRewardJob(@Body() body: OpRebateRewardBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      await this.scraperQueuesService.publishMessage<OpRebateRewardMessage>(ScraperQueue.OpRebateReward, {
        depositPrimaryKey: depositId,
      });
    }
  }

  @Post("scraper/arb-rebate-reward")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async submitArbRebateRewardJob(@Body() body: OpRebateRewardBody) {
    const { fromDepositId, toDepositId } = body;

    for (let depositId = fromDepositId; depositId <= toDepositId; depositId++) {
      this.scraperQueuesService.publishMessage<ArbRebateRewardMessage>(ScraperQueue.ArbRebateReward, {
        depositPrimaryKey: depositId,
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

  @Post("scraper/fee-breakdown/backfill")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async backfillFeeBreakdown(@Body() body: BackfillFeeBreakdownBody) {
    await this.scraperService.backfillFeeBreakdown(body);
  }

  @Post("scraper/deposit-filled-date/backfill")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async backfillFilledDate(@Body() body: BackfillFilledDateBody) {
    await this.scraperService.backfillFilledDate(body);
  }

  @Post("scraper/depositor-address/backfill")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async backfillDepositorAddress(@Body() body: BackfillDepositorAddressBody) {
    return this.scraperService.backfillDepositorAddress(body);
  }

  @Post("scraper/fix-bridge-fee")
  @ApiTags("scraper")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  async fixBridgeFee() {
    return this.scraperService.fixBridgeFee();
  }
}
