import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "../user/module";

import { WalletRewardsFixture } from "./adapter/db/wallet-rewards-fixture";
import { CommunityRewardsFixture } from "./adapter/db/community-rewards-fixture";
import { AirdropService } from "./services/airdrop-service";
import { AirdropController } from "./entry-points/http/controller";

import { CommunityRewards } from "./model/community-rewards.entity";
import { WalletRewards } from "./model/wallet-rewards.entity";
import { Deposit } from "../scraper/model/deposit.entity";

@Module({
  providers: [AirdropService, WalletRewardsFixture, CommunityRewardsFixture],
  controllers: [AirdropController],
  imports: [TypeOrmModule.forFeature([CommunityRewards, WalletRewards, Deposit]), UserModule],
  exports: [],
})
export class AirdropModule {}
