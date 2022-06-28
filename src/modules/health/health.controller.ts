import { Body, Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthDto, HealthParamsDto } from "./health.dto";
import { HealthService } from "./health.service";

@Controller("api/health")
@ApiTags("health")
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  async getHealth(@Body() getHealthDto: HealthDto) {
    this.healthService.exec();

    return {
      ...getHealthDto,
    };
  }

  @Get("/:scope")
  async getHealthForScope(@Param() getHealthForScopeParams: HealthParamsDto) {
    this.healthService.exec();

    return {
      scope: getHealthForScopeParams.scope,
    };
  }
}
