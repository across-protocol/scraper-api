import { Controller, UseGuards, Body, Delete } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

import { ReferralService } from "../../services/service";
import { DeleteReferralsMerkleDistributionBody } from "./dto";
import { JwtAuthGuard } from "../../../auth/entry-points/http/jwt.guard";
import { Role, Roles, RolesGuard } from "../../../auth/entry-points/http/roles";

@Controller()
export class ReferralController {
  public constructor(private referralService: ReferralService) {}

  @Delete("referrals/merkle-distribution")
  @Roles(Role.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiTags("referrals")
  deleteReferralsMerkleDistribution(@Body() body: DeleteReferralsMerkleDistributionBody) {
    const { windowIndex } = body;
    return this.referralService.revertReferralsMerkleDistribution(windowIndex);
  }
}
