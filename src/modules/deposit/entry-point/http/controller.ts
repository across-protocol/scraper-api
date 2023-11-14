import { Controller, Get, Query } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { DepositService } from "../../service";
import {
  GetDepositsQuery,
  GetDepositDetailsQuery,
  GetDepositsStatsResponse,
  GetDepositsV2Query,
  GetDepositsForTxPageQuery,
} from "./dto";

@Controller()
export class DepositController {
  public constructor(private depositService: DepositService) {}

  @Get("deposits/tx-page")
  @ApiTags("deposits")
  getDepositsForTxPage(@Query() query: GetDepositsForTxPageQuery) {
    return this.depositService.getDepositsForTxPage(query);
  }

  // TODO: Deprecate this endpoint if FE migrated to above `/deposits/tx-page` endpoint
  @Get("deposits")
  @ApiTags("deposits")
  getDeposits(@Query() query: GetDepositsQuery) {
    return this.depositService.getDepositsForTxPage({
      userAddress: query.address || undefined,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("v2/deposits")
  getDepositsV2(@Query() query: GetDepositsV2Query) {
    return this.depositService.getDepositsV2(query);
  }

  @Get("deposits/details")
  @ApiTags("deposits")
  getDepositsDetails(@Query() query: GetDepositDetailsQuery) {
    return this.depositService.getDepositDetails(query.depositTxHash, parseInt(query.originChainId));
  }

  @Get("deposits/stats")
  @ApiTags("deposits")
  @ApiResponse({ type: GetDepositsStatsResponse })
  getDepositsStats() {
    return this.depositService.getCachedGeneralStats();
  }
}
