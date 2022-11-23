import { Controller, Get, Query, UseGuards, Post, Body, Delete } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

import { ReferralService } from "../../services/service";
import {
  PostReferralsMerkleDistributionBody,
  GetReferralsQuery,
  GetReferralsSummaryQuery,
  DeleteReferralsMerkleDistributionBody,
} from "./dto";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";

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

  @Post("referrals/merkle-distribution")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("referrals")
  postReferralsMerkleDistribution(@Body() body: PostReferralsMerkleDistributionBody) {
    const { maxDepositDate, windowIndex } = body;
    return this.referralService.createReferralsMerkleDistribution(parseInt(windowIndex), new Date(maxDepositDate));
  }

  @Delete("referrals/merkle-distribution")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("referrals")
  deleteReferralsMerkleDistribution(@Body() body: DeleteReferralsMerkleDistributionBody) {
    const { windowIndex } = body;
    return this.referralService.revertReferralsMerkleDistribution(parseInt(windowIndex));
  }
}
