import { DynamicModule, Module, Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../configuration/configuration.module";
import { DepositsMv } from "../deposit/model/DepositsMv.entity";
import { Deposit } from "../deposit/model/deposit.entity";
import { ReferralController } from "./entry-points/http/controller";
import { ReferralCronService } from "./services/cron-service";
import { ReferralService } from "./services/service";
import { ModuleOptions, RunMode } from "../../dynamic-module";
import { Web3Module } from "../web3/module";
import { ReferralRewardsWindowJob } from "./model/ReferralRewardsWindowJob.entity";
import { ReferralRewardsWindowJobResult } from "./model/ReferralRewardsWindowJobResult.entity";

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
          TypeOrmModule.forFeature([Deposit, DepositsMv, ReferralRewardsWindowJob, ReferralRewardsWindowJobResult]),
          AppConfigModule,
          Web3Module,
        ],
        exports: [...module.exports, ReferralService],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Scraper)) {
      module = {
        ...module,
        providers: [...module.providers, ReferralCronService, ReferralService],
        imports: [
          ...module.imports,
          TypeOrmModule.forFeature([Deposit, DepositsMv, ReferralRewardsWindowJob, ReferralRewardsWindowJobResult]),
          AppConfigModule,
          Web3Module,
        ],
        exports: [...module.exports, ReferralService],
      };
    }

    return module;
  }
}
