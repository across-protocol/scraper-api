import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CronExpression } from "@nestjs/schedule";
import {performance, PerformanceObserver} from "perf_hooks";

import { AppConfig } from "../../configuration/configuration.service";
import { EnhancedCron, splitArrayInChunks } from "../../../utils";

import { ScraperQueuesService } from "./ScraperQueuesService";
import {ELIGIBLE_OP_REWARDS_CHAIN_IDS} from "../../rewards/services/op-rebate-service";
import { RewardedDeposit } from "../../rewards/model/RewardedDeposit.entity";
import { OpRebateRewardV2Message, ScraperQueue } from "../adapter/messaging";

@Injectable()
export class CopyIndexerDepositsCron {
  private logger = new Logger(CopyIndexerDepositsCron.name);
  private lock = false;

  constructor(
    private appConfig: AppConfig,
    private dataSource: DataSource,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @EnhancedCron(CronExpression.EVERY_30_SECONDS)
  async run() {
    try {
      const perfObserver = new PerformanceObserver((items) => {
        items.getEntries().forEach((entry) => {
          console.log(entry);
        });
      });
      perfObserver.observe({ entryTypes: ["measure"], buffered: true });
      if (this.lock) {
        this.logger.warn("CopyIndexerDepositsCron is locked");
        return;
      }
      this.lock = true;

      await this.copyIndexerDeposits();

      this.lock = false;
      performance.clearMarks();
    } catch (error) {
      console.log(error);
      this.logger.error(error);
      this.lock = false;
    }
  }

  private async copyIndexerDeposits() {
    let eligibleDestinationChains = [];
    if (this.appConfig.values.rewardPrograms["op-rebates"].enabled){
        eligibleDestinationChains = ELIGIBLE_OP_REWARDS_CHAIN_IDS;
    }

    if (eligibleDestinationChains.length > 0){
      const newFilledDepositsQuery = `
        WITH indexer_deposits AS (
          SELECT
            indexer_rhi."relayHash" as "relayHash",
            indexer_rhi."depositTxHash" as "depositTxHash",
            indexer_rhi."depositId" as "depositId",
            indexer_rhi."originChainId" as "originChainId",
            indexer_rhi."destinationChainId" as "destinationChainId",
            indexer_deposit_events.depositor as depositor,
            indexer_deposit_events.recipient as recipient,
            indexer_deposit_events."inputToken" as "inputToken",
            indexer_deposit_events."inputAmount" as "inputAmount",
            indexer_deposit_events."outputToken" as "outputToken",
            indexer_deposit_events."outputAmount" as "outputAmount",
            indexer_deposit_events."exclusiveRelayer" as "exclusiveRelayer",
            indexer_deposit_events."blockTimestamp" as "blockTimestamp",
            indexer_rhi."fillTxHash" as "fillTxHash",
            indexer_fills.relayer as relayer
          FROM
            relay_hash_info indexer_rhi
          JOIN evm.v3_funds_deposited indexer_deposit_events ON
            indexer_rhi."depositEventId" = indexer_deposit_events.id
          JOIN evm.filled_v3_relay indexer_fills ON
            indexer_rhi."fillEventId" = indexer_fills.id
          WHERE
            indexer_rhi."status" = 'filled'
            AND indexer_deposit_events.finalised is true
            AND indexer_fills.finalised is true
            AND indexer_rhi."destinationChainId" in (${eligibleDestinationChains})
            LIMIT 5000
        )
        SELECT
          indexer_deposits.*
        FROM indexer_deposits
        LEFT JOIN rewarded_deposit ON indexer_deposits."relayHash" = rewarded_deposit."relayHash"
        WHERE rewarded_deposit."relayHash" IS NULL;
      `;

    performance.mark("query-start");
    const newFilledDeposits = await this.dataSource.query(newFilledDepositsQuery) as RewardedDeposit[];
    performance.mark("query-end");
    performance.measure("query", "query-start", "query-end");

    const portionDeposits = newFilledDeposits.slice(0,10);
    performance.mark("insert-start");
    const insertResults = await Promise.all(splitArrayInChunks(portionDeposits, 2).map(deps=> this.dataSource
      .getRepository(RewardedDeposit)
      .createQueryBuilder()
      .insert()
      .values(deps.map(dep => {return {...dep, depositDate: new Date(), totalBridgeFeeUsd: "3"};}))
      .returning("*")
      .execute())); 
    performance.mark("insert-end");
    performance.measure("insert", "insert-start", "insert-end");

    const savedDeposits = insertResults.map(result=>result.generatedMaps);

    // For each inserted deposit, send messages to new op worker
    for (const deposit of savedDeposits){
      const queueMsg = {depositId: deposit["depositId"], originChainId: deposit["originChainId"]};
      console.log(deposit);
      console.log(queueMsg);
      console.log("publishing message");
      try{
        await this.scraperQueuesService.publishMessage<OpRebateRewardV2Message>(
          ScraperQueue.OpRebateRewardV2,
          queueMsg,
        );
      } catch (err){
        console.log(err);
      }
    }
    }
    
  }
}