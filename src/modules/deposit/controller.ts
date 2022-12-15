import { Controller, Get, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { DepositService } from "./service";
import { GetDepositsQuery, GetDepositsStatsResponse } from "./dto";

@Controller()
export class DepositController {
  public constructor(private depositService: DepositService) {}

  @Get("deposits")
  @ApiTags("deposits")
  getDeposits(@Query() query: GetDepositsQuery) {
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");

    if (query.address) {
      return this.depositService.getUserDeposits(query.address, query.status, limit, offset);
    }

    return this.depositService.getDeposits(query.status, limit, offset);
  }

  @Get("deposits/stats")
  @ApiTags("deposits")
  @ApiResponse({ type: GetDepositsStatsResponse })
  getDepositsStats() {
    return this.depositService.getCachedGeneralStats();
  }
}
