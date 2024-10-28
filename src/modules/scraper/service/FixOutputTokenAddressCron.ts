import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ethers } from "ethers";
import { Cron, CronExpression } from "@nestjs/schedule";

import { Deposit } from "../../deposit/model/deposit.entity";
import { ScraperQueuesService } from "./ScraperQueuesService";
import {
  ScraperQueue,
  SuggestedFeesQueueMessage,
  TokenDetailsQueueMessage,
} from "../adapter/messaging";
import { DepositService } from "../../deposit/service";

@Injectable()
export class FixOutputTokenAddressCron {
  private logger = new Logger(FixOutputTokenAddressCron.name);
  private lock = false;

  constructor(
    private dataSource: DataSource,
    private scraperQueuesService: ScraperQueuesService,
    private depositService: DepositService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run() {
    try {
      if (this.lock) {
        this.logger.warn("FixOutputTokenAddressCron is locked");
        return;
      }
      this.lock = true;
      await this.fixOutputTokenAddress();
      this.lock = false;
    } catch (error) {
      this.logger.error(error);
      this.lock = false;
    }
  }

  private async fixOutputTokenAddress() {
    const query = this.dataSource
      .createQueryBuilder()
      .select()
      .from(Deposit, "d")
      .where("d.outputTokenAddress = :address", { address: ethers.constants.AddressZero })
      .andWhere("d.depositDate > '2024-01-01'");
    const deposits = await query.getMany();
    this.logger.verbose(`Found ${deposits.length} deposits with outputTokenAddress = ${ethers.constants.AddressZero}`);

    for (const deposit of deposits) {
      const outputTokenAddress = await this.depositService.deriveOutputTokenAddress(
        deposit.sourceChainId,
        deposit.tokenAddr,
        deposit.destinationChainId,
        deposit.quoteTimestamp.getTime() / 1000,
      );
      if (outputTokenAddress) {
        await this.dataSource
          .createQueryBuilder()
          .update(Deposit)
          .set({ outputTokenAddress })
          .where("id = :id", { id: deposit.id })
          .execute();
        console.log(`Updated deposit ${deposit.id} with outputTokenAddress = ${outputTokenAddress}`);
        await this.scraperQueuesService.publishMessage<TokenDetailsQueueMessage>(ScraperQueue.TokenDetails, {
          depositId: deposit.id,
        });
        await this.scraperQueuesService.publishMessage<SuggestedFeesQueueMessage>(ScraperQueue.SuggestedFees, {
          depositId: deposit.id,
        });
      }
    }
  }
}
