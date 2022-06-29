import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReferralService } from "../../services/service";
import { GetReferralsSummaryQuery } from "./dto";

@Controller()
export class ReferralController {
  public constructor(private referralService: ReferralService) {}

  @Get("referrals/:address/summary")
  @ApiTags("referrals")
  getReferralSummary(@Query() query: GetReferralsSummaryQuery) {
    return this.referralService.getReferralSummary(query.address);
  }
}
