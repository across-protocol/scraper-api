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
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");
    return this.depositService.getDeposits(query.status, limit, offset);
  }
}
