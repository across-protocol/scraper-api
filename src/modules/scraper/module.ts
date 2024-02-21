import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bull";
import { DynamicModule, Module, Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AppConfigModule } from "../configuration/configuration.module";
import { MarketPriceModule } from "../market-price/module";
import { ReferralModule } from "../referral/module";
import { Web3Module } from "../web3/module";
import { RewardModule } from "../rewards/module";
import { FilledRelayEv, FundsDepositedEv, RequestedSpeedUpDepositEv } from "../web3/model";
import { ScraperQueue } from "./adapter/messaging";
import { BlockNumberConsumer } from "./adapter/messaging/BlockNumberConsumer";
import { BlocksEventsConsumer } from "./adapter/messaging/BlocksEventsConsumer";
import { MerkleDistributorBlocksEventsConsumer } from "./adapter/messaging/MerkleDistributorBlocksEventsConsumer";
import { MerkleDistributorBlocksEventsConsumerV2 } from "./adapter/messaging/MerkleDistributorBlocksEventsConsumerV2";
import { DepositFilledDateConsumer } from "./adapter/messaging/DepositFilledDateConsumer";
import { DepositReferralConsumer } from "./adapter/messaging/DepositReferralConsumer";
import { FillEventsConsumer } from "./adapter/messaging/FillEventsConsumer";
import { FillEventsConsumer2 } from "./adapter/messaging/FillEventsConsumer2";
import { FillEventsV3Consumer } from "./adapter/messaging/FillEventsV3Consumer";
import { SpeedUpEventsConsumer } from "./adapter/messaging/SpeedUpEventsConsumer";
import { TokenDetailsConsumer } from "./adapter/messaging/TokenDetailsConsumer";
import { TokenPriceConsumer } from "./adapter/messaging/TokenPriceConsumer";
import { MerkleDistributorClaimConsumer } from "./adapter/messaging/MerkleDistributorClaimConsumer";
import { ScraperController } from "./entry-point/http/controller";
import { Deposit } from "../deposit/model/deposit.entity";
import { Claim } from "../airdrop/model/claim.entity";
import { ProcessedBlock } from "./model/ProcessedBlock.entity";
import { MerkleDistributorProcessedBlock } from "./model/MerkleDistributorProcessedBlock.entity";
import { ScraperService } from "./service";
import { ScraperQueuesService } from "./service/ScraperQueuesService";
import { DepositAcxPriceConsumer } from "./adapter/messaging/DepositAcxPriceConsumer";
import { SuggestedFeesConsumer } from "./adapter/messaging/SuggestedFeesConsumer";
import { SuggestedFeesService } from "./adapter/across-serverless-api/suggested-fees-service";
import { TrackFillEventConsumer } from "./adapter/messaging/TrackFillEventConsumer";
import { FeeBreakdownConsumer } from "./adapter/messaging/FeeBreakdownConsumer";
import { TrackService } from "./adapter/amplitude/track-service";
import { GasFeesService } from "./adapter/gas-fees/gas-fees-service";
import { ModuleOptions } from "../../dynamic-module";
import { DepositModule } from "../deposit/module";
import { AirdropModule } from "../airdrop/module";
import { RectifyStickyReferralConsumer } from "./adapter/messaging/RectifyStickyReferralConsumer";
import { OpRebateRewardConsumer } from "./adapter/messaging/OpRebateRewardConsumer";
import { OpRebateService } from "../rewards/services/op-rebate-service";
import { OpReward } from "../rewards/model/op-reward.entity";
import { QueuesMonitoringCron } from "./service/queues-monitoring-cron";
import { QueueJobCount } from "../monitoring/model/QueueJobCount.entity";
import { MerkleDistributorClaim } from "../airdrop/model/merkle-distributor-claim.entity";
import { MerkleDistributorWindow } from "../airdrop/model/merkle-distributor-window.entity";
import { SpeedUpEventsV3Consumer } from "./adapter/messaging/SpeedUpEventsV3Consumer";
import { Token } from "../web3/model/token.entity";

@Module({})
export class ScraperModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    const providers: Provider<any>[] = [
      ScraperService,
      ScraperQueuesService,
      QueuesMonitoringCron,
      SuggestedFeesService,
      TrackService,
      GasFeesService,
      OpRebateService,
      BlocksEventsConsumer,
      MerkleDistributorBlocksEventsConsumer,
      MerkleDistributorBlocksEventsConsumerV2,
      FillEventsConsumer,
      FillEventsConsumer2,
      FillEventsV3Consumer,
      SpeedUpEventsConsumer,
      SpeedUpEventsV3Consumer,
      BlockNumberConsumer,
      TokenDetailsConsumer,
      DepositReferralConsumer,
      TokenPriceConsumer,
      DepositFilledDateConsumer,
      DepositAcxPriceConsumer,
      SuggestedFeesConsumer,
      TrackFillEventConsumer,
      RectifyStickyReferralConsumer,
      FeeBreakdownConsumer,
      OpRebateRewardConsumer,
      MerkleDistributorClaimConsumer,
    ];

    return {
      module: ScraperModule,
      providers,
      imports: [
        Web3Module,
        AppConfigModule,
        TypeOrmModule.forFeature([
          ProcessedBlock,
          MerkleDistributorProcessedBlock,
          Claim,
          Deposit,
          FundsDepositedEv,
          FilledRelayEv,
          RequestedSpeedUpDepositEv,
          OpReward,
          QueueJobCount,
          MerkleDistributorClaim,
          MerkleDistributorWindow,
          Token,
        ]),
        MarketPriceModule.forRoot(moduleOptions),
        HttpModule,
        DepositModule.forRoot(moduleOptions),
        AirdropModule.forRoot(moduleOptions),
        ReferralModule.forRoot(moduleOptions),
        RewardModule.forRoot(moduleOptions),
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
          name: ScraperQueue.MerkleDistributorBlocksEventsV2,
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
          name: ScraperQueue.FillEvents2,
          defaultJobOptions: {
            backoff: 120 * 1000,
            attempts: Number.MAX_SAFE_INTEGER,
            removeOnComplete: true,
            removeOnFail: true,
          },
        }),
        BullModule.registerQueue({
          name: ScraperQueue.FillEventsV3,
          defaultJobOptions: {
            backoff: 120 * 1000,
            attempts: Number.MAX_SAFE_INTEGER,
            removeOnComplete: true,
            removeOnFail: true,
          },
        }),
        BullModule.registerQueue({
          name: ScraperQueue.SpeedUpEvents,
          defaultJobOptions: {
            backoff: 120 * 1000,
            attempts: Number.MAX_SAFE_INTEGER,
            removeOnComplete: true,
            removeOnFail: true,
          },
        }),
        BullModule.registerQueue({
          name: ScraperQueue.SpeedUpEventsV3,
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
        BullModule.registerQueue({
          name: ScraperQueue.SuggestedFees,
        }),
        BullModule.registerQueue({
          name: ScraperQueue.TrackFillEvent,
        }),
        BullModule.registerQueue({
          name: ScraperQueue.RectifyStickyReferral,
        }),
        BullModule.registerQueue({
          name: ScraperQueue.FeeBreakdown,
        }),
        BullModule.registerQueue({
          name: ScraperQueue.OpRebateReward,
        }),
        BullModule.registerQueue({
          name: ScraperQueue.MerkleDistributorClaim,
        }),
      ],
      exports: [ScraperQueuesService],
      controllers: [ScraperController],
    };
  }
}
