import { DynamicModule, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppConfigModule } from "../configuration/configuration.module";
import { Deposit } from "../deposit/model/deposit.entity";
import { Web3Module } from "../web3/module";

import { RewardsController } from "./entrypoints/http/controller";
import { OpRebateService } from "./services/op-rebate-service";
import { Reward } from "./model/reward.entity";

@Module({})
export class RewardModule {
  static forRoot(): DynamicModule {
    const module: DynamicModule = {
      module: RewardModule,
      controllers: [RewardsController],
      providers: [OpRebateService],
      imports: [TypeOrmModule.forFeature([Deposit, Reward]), AppConfigModule, Web3Module],
      exports: [OpRebateService],
    };

    return module;
  }
}
