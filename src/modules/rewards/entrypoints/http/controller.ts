import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import {
  GetRewardsQuery,
  GetSummaryQuery,
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

  @Get("rewards/arb-rebates/summary")
  @ApiTags("rewards")
  getArbRebatesSummary(@Query() query: GetSummaryQuery) {
    return this.rewardService.getArbRebatesSummary(query);
  }

  @Get("rewards/arb-rebates")
  @ApiTags("rewards")
  getArbRebates(@Query() query: GetRewardsQuery) {
    return this.rewardService.getArbRebateRewardDeposits(query);
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

  @Get("rewards/op-rebates/stats")
  @ApiTags("rewards")
  getOpRebatesStats() {
    return this.rewardService.getOpRebatesStats();
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
