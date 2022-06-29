import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Deposit } from "../scraper/model/deposit.entity";
import { ReferralController } from "./entry-points/http/controller";
import { ReferralService } from "./services/service";

@Module({
  controllers: [ReferralController],
  providers: [ReferralService],
  imports: [TypeOrmModule.forFeature([Deposit])],
})
export class ReferralModule {}
