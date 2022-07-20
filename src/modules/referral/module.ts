import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../configuration/configuration.module";
import { Deposit } from "../scraper/model/deposit.entity";
import { ReferralController } from "./entry-points/http/controller";
import { ReferralCronService } from "./services/cron-service";
import { ReferralService } from "./services/service";

@Module({
  controllers: [ReferralController],
  exports: [ReferralService],
  providers: [ReferralService, ReferralCronService],
  imports: [TypeOrmModule.forFeature([Deposit]), AppConfigModule],
})
export class ReferralModule {}
