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
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");

    if (query.address) {
      return this.depositService.getUserDeposits(query.address, query.status, limit, offset);
    }

    return this.depositService.getDeposits(query.status, limit, offset);
  }

  @Get("v2/deposits")
  getDepositsV2(@Query() query: GetDepositsV2Query) {
    return this.depositService.getDepositsV2(query);
  }

  @Get("deposits/pending")
  @ApiTags("deposits")
  getPendingDeposits(@Query() query: GetDepositsQuery) {
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");
    return this.depositService.getPendingDeposits(limit, offset);
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
