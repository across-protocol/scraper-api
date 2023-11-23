import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { GetRewardsQuery, GetSummaryQuery, GetReferralRewardsSummaryQuery } from "./dto";
import { RewardService } from "../../services/reward-service";

@Controller()
export class RewardController {
  public constructor(private rewardService: RewardService) {}

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
}
