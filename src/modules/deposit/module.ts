import { DynamicModule, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModuleOptions, RunMode } from "../../dynamic-module";
import { AppConfigModule } from "../configuration/configuration.module";
import { Deposit } from "./model/deposit.entity";
import { DepositController } from "./entry-point/http/controller";
import { DepositService } from "./service";
import { DepositFixture } from "./adapter/db/deposit-fixture";
import { EtlController } from "./entry-point/http/etl-controller";
import { RewardModule } from "../rewards/module";
import { OpReward } from "../rewards/model/op-reward.entity";

@Module({})
export class DepositModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: DepositModule, providers: [], controllers: [], imports: [], exports: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal) || moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        controllers: [...module.controllers, DepositController, EtlController],
        providers: [...module.providers, DepositService],
        exports: [...module.exports, DepositService],
        imports: [
          ...module.imports,
          TypeOrmModule.forFeature([Deposit, OpReward]),
          AppConfigModule,
          RewardModule.forRoot(moduleOptions),
        ],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        providers: [...module.providers, DepositFixture],
      };
    }

    return module;
  }
}
