import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  GetRewardsQuery,
  GetSummaryQuery,
  GetReferralRewardsSummaryQuery,
  CreateRewardsWindowJobBody,
  GetRewardsWindowJobParams,
} from "./dto";
import { RewardService } from "../../services/reward-service";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";

@Controller()
export class RewardController {
  public constructor(private rewardService: RewardService) {}

  @Get("rewards/earned")
  @ApiTags("rewards")
  getSummary(@Query() query: GetSummaryQuery) {
    return this.rewardService.getEarnedRewards(query);
  }

  @Get("rewards/op-rebates/summary")
  @ApiTags("rewards")
  getOpRebatesSummary(@Query() query: GetSummaryQuery) {
    return this.rewardService.getOpRebatesSummary(query);
  }

  @Get("rewards/op-rebates")
  @ApiTags("rewards")
  getOpRebates(@Query() query: GetRewardsQuery) {
    return this.rewardService.getOpRebateRewardDeposits(query);
  }

  @Get("rewards/referrals/summary")
  @ApiTags("rewards")
  getReferralsSummary(@Query() query: GetReferralRewardsSummaryQuery) {
    return this.rewardService.getReferralRewardsSummary(query);
  }

  @Get("rewards/referrals")
  @ApiTags("rewards")
  getReferralRewards(@Query() query: GetRewardsQuery) {
    return this.rewardService.getReferralRewardDeposits(query);
  }

  @Post("rewards-window-job")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("rewards")
  createRewardsWindowJob(@Body() body: CreateRewardsWindowJobBody) {
    return this.rewardService.createRewardsWindowJob(body);
  }

  @Get("rewards-window-job/:id")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("rewards")
  getRewardsWindowJob(@Param() params: GetRewardsWindowJobParams) {
    const { id } = params;
    return this.rewardService.getRewardsWindowJob(id);
  }
}
