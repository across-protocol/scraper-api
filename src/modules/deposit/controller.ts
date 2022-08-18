import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DepositService } from "./service";
import { GetDepositsQuery } from "./dto";

@Controller()
export class DepositController {
  public constructor(private depositService: DepositService) {}

  @Get("deposits")
  @ApiTags("deposits")
  getDeposits(@Query() query: GetDepositsQuery) {
    const limit = isNaN(parseInt(query.limit)) ? 10 : parseInt(query.limit);
    const offset = isNaN(parseInt(query.offset)) ? 0 : parseInt(query.offset);
    return this.depositService.getDeposits(query.status, limit, offset);
  }
}
