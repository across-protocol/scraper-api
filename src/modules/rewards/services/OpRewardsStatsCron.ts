import { Injectable, Logger } from "@nestjs/common";
import { CronExpression } from "@nestjs/schedule";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { EnhancedCron } from "../../../utils";
import { OpReward } from "../model/op-reward.entity";
import { OpRewardsStats } from "../model/op-rewards-stats.entity";

@Injectable()
export class OpRewardsStatsCron {
  private logger = new Logger(OpRewardsStatsCron.name);
  private semaphore = false;

  constructor(
    @InjectRepository(OpReward)
    private opRewardRepository: Repository<OpReward>,
    @InjectRepository(OpRewardsStats)
    private opRewardsStatsRepository: Repository<OpRewardsStats>,
  ) {}

  @EnhancedCron(CronExpression.EVERY_30_SECONDS)
  async startCron() {
    try {
      if (this.semaphore) return;
      this.semaphore = true;

      await this.computeOpRewardsStats();

      this.semaphore = false;
    } catch (error) {
      this.semaphore = false;
      this.logger.error(error);
    }
  }

  private async computeOpRewardsStats() {
    const totalAmount = await this.opRewardRepository.query(`
      select sum(r.amount::decimal)
      from op_reward r;
    `);

    if (totalAmount?.[0]?.sum) {
      this.logger.log(`Total OP rewards: ${totalAmount?.[0]?.sum}`);
      await this.opRewardsStatsRepository.upsert(
        { id: 1, totalTokenAmount: totalAmount?.[0]?.sum },
        { conflictPaths: { id: true } },
      );
    } else {
      this.logger.error("No total amount found");
    }
  }
}
