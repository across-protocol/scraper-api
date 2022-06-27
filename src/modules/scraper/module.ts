import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppConfigModule } from "../configuration/configuration.module";
import { Web3Module } from "../web3/module";

import { ScraperQueue } from "./adapter/messaging";
import { BlockNumberConsumer } from "./adapter/messaging/BlockNumberConsumer";
import { BlocksBatchConsumer } from "./adapter/messaging/BlocksBatchConsumer";
import { DepositReferralConsumer } from "./adapter/messaging/DepositReferralConsumer";
import { FillEventsConsumer } from "./adapter/messaging/FillEventsConsumer";
import { TokenDetailsConsumer } from "./adapter/messaging/TokenDetailsConsumer";
import { ScraperController } from "./entry-point/http/controller";
import { Deposit } from "./model/deposit.entity";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { ScraperService } from "./service";
import { ScraperQueuesService } from "./service/ScraperQueuesService";

@Module({
  providers: [
    ScraperService,
    ScraperQueuesService,
    BlocksBatchConsumer,
    FillEventsConsumer,
    BlockNumberConsumer,
    TokenDetailsConsumer,
    DepositReferralConsumer,
  ],
  imports: [
    Web3Module,
    AppConfigModule,
    TypeOrmModule.forFeature([ProcessedBlock, Deposit]),
    BullModule.registerQueue({
      name: ScraperQueue.BlockNumber,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.BlocksBatch,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.TokenDetails,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.DepositReferral,
    }),
    BullModule.registerQueue({
      name: ScraperQueue.FillEvents,
      defaultJobOptions: {
        backoff: 120 * 1000,
        attempts: Number.MAX_SAFE_INTEGER,
      },
    }),
  ],
  exports: [ScraperQueuesService],
  controllers: [ScraperController],
})
export class ScraperModule {}
