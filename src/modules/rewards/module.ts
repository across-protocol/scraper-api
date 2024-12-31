import { DynamicModule, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppConfigModule } from "../configuration/configuration.module";
import { Deposit } from "../deposit/model/deposit.entity";
import { Web3Module } from "../web3/module";

import { RewardController } from "./entrypoints/http/controller";
import { OpRebateService } from "./services/op-rebate-service";
import { RewardService } from "./services/reward-service";
import { ReferralService } from "../referral/services/service";
import { ReferralModule } from "../referral/module";
import { OpReward } from "./model/op-reward.entity";
import { DepositsMv } from "../deposit/model/DepositsMv.entity";
import { RewardsWindowJob } from "./model/RewardsWindowJob.entity";
import { ReferralRewardsWindowJobResult } from "./model/RewardsWindowJobResult.entity";
import { MarketPriceModule } from "../market-price/module";
import { ModuleOptions, RunMode } from "../../dynamic-module";
import { RewardFixture } from "./adapter/db/op-reward-fixture";
import { ReferralRewardsService } from "./services/referral-rewards-service";
import { RewardsWindowJobFixture } from "./adapter/db/rewards-window-job-fixture";
import { ArbRebateService } from "./services/arb-rebate-service";
import { ArbReward } from "./model/arb-reward.entity";
import { ArbRewardFixture } from "./adapter/db/arb-reward-fixture";
import { RewardedDeposit } from "./model/RewardedDeposit.entity";
import { OpRewardV2 } from "./model/OpRewardV2.entity";
import { OpRebateServiceV2 } from "./services/opRebateServiceV2";

@Module({})
export class RewardModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    const module: DynamicModule = {
      module: RewardModule,
      controllers: [RewardController],
      providers: [
        ArbRebateService, OpRebateService, OpRebateServiceV2, ReferralService, ReferralRewardsService, RewardService,
      ],
      imports: [
        TypeOrmModule.forFeature([
          Deposit,
          OpReward,
          OpRewardV2,
          DepositsMv,
          RewardedDeposit,
          RewardsWindowJob,
          ReferralRewardsWindowJobResult,
          ArbReward,
        ]),
        AppConfigModule,
        Web3Module,
        ReferralModule.forRoot(moduleOptions),
        MarketPriceModule.forRoot(),
      ],
      exports: [ArbRebateService, OpRebateService, OpRebateServiceV2, ReferralService, RewardService],
    };

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      module.providers = [...module.providers, ArbRewardFixture, RewardFixture, RewardsWindowJobFixture];
    }

    return module;
  }
}
