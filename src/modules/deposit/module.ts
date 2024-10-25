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
import { SetPoolRebalanceRouteEvent } from "../web3/model/SetPoolRebalanceRouteEvent.entity";
import { Block } from "../web3/model/block.entity";

@Module({})
export class DepositModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = {
      module: DepositModule,
      providers: [DepositService, DepositFixture],
      exports: [DepositService],
      controllers: [],
      imports: [
        TypeOrmModule.forFeature([
          Block,
          Deposit,
          OpReward,
          SetPoolRebalanceRouteEvent,
        ]),
        AppConfigModule,
        RewardModule.forRoot(moduleOptions),
      ],
    };

    if (moduleOptions.runModes.includes(RunMode.Normal) || moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        controllers: [...module.controllers, DepositController, EtlController],
      };
    }

    return module;
  }
}
