import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReferralService } from "../../services/service";
import { GetReferralsQuery, GetReferralsSummaryQuery } from "./dto";

@Controller()
export class ReferralController {
  public constructor(private referralService: ReferralService) {}

  @Get("referrals/summary")
  @ApiTags("referrals")
  getReferralSummary(@Query() query: GetReferralsSummaryQuery) {
    return this.referralService.getReferralSummary(query.address);
  }

  @Get("referrals/details")
  @ApiTags("referrals")
  getReferral(@Query() query: GetReferralsQuery) {
    const limit = isNaN(parseInt(query.limit)) ? 10 : parseInt(query.limit);
    const offset = isNaN(parseInt(query.offset)) ? 10 : parseInt(query.offset);
    return this.referralService.getReferrals(query.address, limit, offset);
  }
}
