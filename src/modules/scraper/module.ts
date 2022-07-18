import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bull";
import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppConfigModule } from "../configuration/configuration.module";
import { MarketPriceModule } from "../market-price/module";
import { ReferralModule } from "../referral/module";
import { Web3Module } from "../web3/module";

import { ScraperQueue } from "./adapter/messaging";
import { BlockNumberConsumer } from "./adapter/messaging/BlockNumberConsumer";
import { BlocksEventsConsumer } from "./adapter/messaging/BlocksEventsConsumer";
import { DepositReferralConsumer } from "./adapter/messaging/DepositReferralConsumer";
import { FillEventsConsumer } from "./adapter/messaging/FillEventsConsumer";
import { TokenDetailsConsumer } from "./adapter/messaging/TokenDetailsConsumer";
import { TokenPriceConsumer } from "./adapter/messaging/TokenPriceConsumer";
import { ScraperController } from "./entry-point/http/controller";
import { Deposit } from "./model/deposit.entity";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { ScraperService } from "./service";
import { ScraperQueuesService } from "./service/ScraperQueuesService";

@Module({
  providers: [
    ScraperService,
    ScraperQueuesService,
    BlocksEventsConsumer,
    FillEventsConsumer,
    BlockNumberConsumer,
    TokenDetailsConsumer,
    DepositReferralConsumer,
    TokenPriceConsumer,
  ],
  imports: [
    Web3Module,
    AppConfigModule,
    TypeOrmModule.forFeature([ProcessedBlock, Deposit]),
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
      name: ScraperQueue.TokenDetails,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.TokenPrice,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.DepositReferral,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.FillEvents,
      defaultJobOptions: {
        backoff: 120 * 1000,
        attempts: Number.MAX_SAFE_INTEGER,
        removeOnComplete: true,
      },
    }),
  ],
  exports: [ScraperQueuesService],
  controllers: [ScraperController],
})
export class ScraperModule {}
