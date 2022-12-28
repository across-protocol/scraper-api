import { Module, Provider, DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "../user/module";
import { AppConfigModule } from "../configuration/configuration.module";

import { WalletRewardsFixture } from "./adapter/db/wallet-rewards-fixture";
import { CommunityRewardsFixture } from "./adapter/db/community-rewards-fixture";
import { AirdropService } from "./services/airdrop-service";
import { AirdropController } from "./entry-points/http/controller";

import { CommunityRewards } from "./model/community-rewards.entity";
import { WalletRewards } from "./model/wallet-rewards.entity";
import { Deposit } from "../scraper/model/deposit.entity";
import { MerkleDistributorWindowFixture } from "./adapter/db/merkle-distributor-window-fixture";
import { MerkleDistributorWindow } from "./model/merkle-distributor-window.entity";
import { MerkleDistributorRecipient } from "./model/merkle-distributor-recipient.entity";
import { MerkleDistributorRecipientFixture } from "./adapter/db/merkle-distributor-recipient";
import { ModuleOptions, RunMode } from "../../dynamic-module";

@Module({})
export class AirdropModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    const providers: Provider<any>[] = [AirdropService];

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      providers.push(
        WalletRewardsFixture,
        CommunityRewardsFixture,
        MerkleDistributorWindowFixture,
        MerkleDistributorRecipientFixture,
      );
    }

    return {
      module: AirdropModule,
      providers,
      controllers: [AirdropController],
      imports: [
        TypeOrmModule.forFeature([
          CommunityRewards,
          WalletRewards,
          Deposit,
          MerkleDistributorWindow,
          MerkleDistributorRecipient,
        ]),
        UserModule.forRoot(moduleOptions),
        AppConfigModule,
      ],
      exports: [],
    };
  }
}
