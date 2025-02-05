import { DynamicModule, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../configuration/configuration.module";
import { Deposit } from "../deposit/model/deposit.entity";
import { ReferralController } from "./entry-points/http/controller";
import { ReferralService } from "./services/service";
import { ModuleOptions, RunMode } from "../../dynamic-module";
import { Web3Module } from "../web3/module";
import { RewardsWindowJob } from "../rewards/model/RewardsWindowJob.entity";
import { ReferralRewardsWindowJobResult } from "../rewards/model/RewardsWindowJobResult.entity";
import { DepositReferralStatFixture } from "./adapter/db/DepositReferralStatFixture";
import { DepositReferralStat } from "../deposit/model/deposit-referral-stat.entity";

@Module({})
export class ReferralModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: ReferralModule, providers: [], controllers: [], imports: [], exports: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal)) {
      module = {
        ...module,
        controllers: [...module.controllers, ReferralController],
        providers: [...module.providers, ReferralService],
        imports: [
          ...module.imports,
          TypeOrmModule.forFeature([
            Deposit,
            RewardsWindowJob,
            ReferralRewardsWindowJobResult,
            DepositReferralStat,
          ]),
          AppConfigModule,
          Web3Module,
        ],
        exports: [...module.exports, ReferralService],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Scraper)) {
      module = {
        ...module,
        providers: [...module.providers, ReferralService],
        imports: [
          ...module.imports,
          TypeOrmModule.forFeature([
            Deposit,
            RewardsWindowJob,
            ReferralRewardsWindowJobResult,
            DepositReferralStat,
          ]),
          AppConfigModule,
          Web3Module,
        ],
        exports: [...module.exports, ReferralService],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        providers: [...module.providers, DepositReferralStatFixture],
      };
    }

    return module;
  }
}
