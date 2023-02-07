import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DepositService } from "../../service";
import { GetEtlReferralDepositsQuery } from "./dto";

@Controller()
export class EtlController {
  constructor(private depositService: DepositService) {}

  @Get("etl/referral-deposits")
  @ApiTags("etl")
  getEtlReferralDeposits(@Query() query: GetEtlReferralDepositsQuery) {
    return this.depositService.getEtlReferralDeposits(query.date);
  }
}
