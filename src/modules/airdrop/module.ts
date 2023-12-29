import { Module, DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "../user/module";
import { AppConfigModule } from "../configuration/configuration.module";

import { WalletRewardsFixture } from "./adapter/db/wallet-rewards-fixture";
import { CommunityRewardsFixture } from "./adapter/db/community-rewards-fixture";
import { AirdropService } from "./services/airdrop-service";
import { AirdropController } from "./entry-points/http/controller";

import { CommunityRewards } from "./model/community-rewards.entity";
import { WalletRewards } from "./model/wallet-rewards.entity";
import { Deposit } from "../deposit/model/deposit.entity";
import { MerkleDistributorWindowFixture } from "./adapter/db/merkle-distributor-window-fixture";
import { MerkleDistributorWindow } from "./model/merkle-distributor-window.entity";
import { MerkleDistributorRecipient } from "./model/merkle-distributor-recipient.entity";
import { MerkleDistributorRecipientFixture } from "./adapter/db/merkle-distributor-recipient";
import { ModuleOptions, RunMode } from "../../dynamic-module";
import { ClaimFixture } from "./adapter/db/claim-fixture";
import { Claim } from "./model/claim.entity";

@Module({})
export class AirdropModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: AirdropModule, providers: [], controllers: [], imports: [], exports: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal) || moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        providers: [...module.providers, AirdropService, ClaimFixture],
        controllers: [...module.controllers, AirdropController],
        imports: [
          ...module.imports,
          TypeOrmModule.forFeature([
            CommunityRewards,
            WalletRewards,
            Deposit,
            MerkleDistributorWindow,
            MerkleDistributorRecipient,
            Claim,
          ]),
          UserModule.forRoot(moduleOptions),
          AppConfigModule,
        ],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        providers: [
          ...module.providers,
          ClaimFixture,
          WalletRewardsFixture,
          CommunityRewardsFixture,
          MerkleDistributorWindowFixture,
          MerkleDistributorRecipientFixture,
        ],
      };
    }

    return module;
  }
}
