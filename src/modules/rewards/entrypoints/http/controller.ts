import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ReferralService } from "../../../referral/services/service";

import { OpRebateService } from "../../services/op-rebate-service";
import { GetRewardsQuery } from "./dto";

@Controller()
export class RewardsController {
  public constructor(private opRebateService: OpRebateService, private referralsService: ReferralService) {}

  @Get("rewards/op-rebates/summary")
  @ApiTags("rewards")
  getOpRebatesSummary() {
    // TODO: implement
    return;
  }

  @Get("rewards/op-rebates")
  @ApiTags("rewards")
  getOpRebates(@Query() query: GetRewardsQuery) {
    return this.opRebateService.getOpRebateRewards(query);
  }

  @Get("rewards/referrals/summary")
  @ApiTags("rewards")
  getReferralsSummary() {
    // TODO: implement
    return;
  }

  @Get("rewards/referrals")
  @ApiTags("rewards")
  getReferralRewards() {
    // TODO: implement
    return;
  }
}
