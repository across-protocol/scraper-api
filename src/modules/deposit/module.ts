import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../configuration/configuration.module";
import { Deposit } from "../scraper/model/deposit.entity";
import { DepositController } from "./controller";
import { DepositService } from "./service";

@Module({
  controllers: [DepositController],
  exports: [DepositService],
  providers: [DepositService],
  imports: [TypeOrmModule.forFeature([Deposit]), AppConfigModule],
})
export class DepositModule {}
