import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { ReferralService } from "../../../referral/services/service";

import { OpRebateService } from "../../services/op-rebate-service";

@Controller()
export class RewardController {
  public constructor(private opRebateService: OpRebateService, private referralsService: ReferralService) {}

  @Get("rewards/op-rebates/summary")
  @ApiTags("rewards")
  getOpRebatesSummary() {
    // TODO: implement
    return;
  }

  @Get("rewards/op-rebates")
  @ApiTags("rewards")
  getOpRebates() {
    // TODO: implement
    return;
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
