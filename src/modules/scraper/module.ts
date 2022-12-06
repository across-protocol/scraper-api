import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppConfigModule } from "../configuration/configuration.module";
import { MarketPriceModule } from "../market-price/module";
import { ReferralModule } from "../referral/module";
import { Web3Module } from "../web3/module";
import { DepositFixture } from "./adapter/db/deposit-fixture";
import { ClaimFixture } from "./adapter/db/claim-fixture";

import { ScraperQueue } from "./adapter/messaging";
import { BlockNumberConsumer } from "./adapter/messaging/BlockNumberConsumer";
import { BlocksEventsConsumer } from "./adapter/messaging/BlocksEventsConsumer";
import { MerkleDistributorBlocksEventsConsumer } from "./adapter/messaging/MerkleDistributorBlocksEventsConsumer";
import { DepositFilledDateConsumer } from "./adapter/messaging/DepositFilledDateConsumer";
import { DepositReferralConsumer } from "./adapter/messaging/DepositReferralConsumer";
import { FillEventsConsumer } from "./adapter/messaging/FillEventsConsumer";
import { TokenDetailsConsumer } from "./adapter/messaging/TokenDetailsConsumer";
import { TokenPriceConsumer } from "./adapter/messaging/TokenPriceConsumer";
import { ScraperController } from "./entry-point/http/controller";
import { Deposit } from "./model/deposit.entity";
import { Claim } from "./model/claim.entity";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { MerkleDistributorProcessedBlock } from "./model/MerkleDistributorProcessedBlock.entity";
import { ScraperService } from "./service";
import { ScraperQueuesService } from "./service/ScraperQueuesService";
import { DepositAcxPriceConsumer } from "./adapter/messaging/DepositAcxPriceConsumer";

@Module({
  providers: [
    ScraperService,
    ScraperQueuesService,
    BlocksEventsConsumer,
    MerkleDistributorBlocksEventsConsumer,
    FillEventsConsumer,
    BlockNumberConsumer,
    TokenDetailsConsumer,
    DepositReferralConsumer,
    TokenPriceConsumer,
    DepositFilledDateConsumer,
    DepositAcxPriceConsumer,
    DepositFixture,
    ClaimFixture,
  ],
  imports: [
    Web3Module,
    AppConfigModule,
    TypeOrmModule.forFeature([ProcessedBlock, MerkleDistributorProcessedBlock, Claim, Deposit]),
    MarketPriceModule,
    HttpModule,
    ReferralModule,
    BullModule.registerQueue({
      name: ScraperQueue.BlockNumber,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.BlocksEvents,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.MerkleDistributorBlocksEvents,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.TokenDetails,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.TokenPrice,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.DepositReferral,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.DepositAcxPrice,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.FillEvents,
      defaultJobOptions: {
        backoff: 120 * 1000,
        attempts: Number.MAX_SAFE_INTEGER,
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),
    BullModule.registerQueue({
      name: ScraperQueue.DepositFilledDate,
    }),
  ],
  exports: [ScraperQueuesService],
  controllers: [ScraperController],
})
export class ScraperModule {}
