import { DateTime } from "luxon";
import { CACHE_MANAGER, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, Not } from "typeorm";
import { Cache } from "cache-manager";
import { Deposit } from "../scraper/model/deposit.entity";
import { getAvgFillTimeQuery, getTotalDepositsQuery, getTotalVolumeQuery } from "./adapter/db/queries";

export const GENERAL_STATS_CACHE_KEY = "stats:general";

@Injectable()
export class DepositService {
  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  public async getCachedGeneralStats() {
    let data = await this.cacheManager.get(GENERAL_STATS_CACHE_KEY);

    if (!data) {
      const [totalVolumeResult, totalDepositsResult, avgFillTime] = await Promise.all([
        this.depositRepository.query(getTotalVolumeQuery()),
        this.depositRepository.query(getTotalDepositsQuery()),
        this.depositRepository.query(getAvgFillTimeQuery()),
      ]);
      data = {
        totalDeposits: parseInt(totalDepositsResult[0]["totalDeposits"]),
        avgFillTime: parseInt(avgFillTime[0]["avgFillTime"]),
        totalVolumeUsd: parseInt(totalVolumeResult[0]["totalVolumeUsd"]),
      };
      await this.cacheManager.set(GENERAL_STATS_CACHE_KEY, data, 60);
    }

    return data;
  }

  public async getDeposits(status, limit = 10, offset = 0) {
    const [deposits, total] = await this.depositRepository.findAndCount({
      where: {
        depositDate: Not(IsNull()),
        status,
      },
      skip: offset,
      take: limit,
      order: {
        depositDate: "desc",
      },
    });

    return {
      deposits: deposits.map(formatDeposit),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }
}

/**
 * Format deposit to entity to match `Transfer` structure from sdk.
 * @param deposit - Deposit entity from db.
 * @returns Formatted deposit entity that matches `Transfer` struct.
 */
export function formatDeposit(deposit: Deposit) {
  return {
    depositId: deposit.depositId,
    depositTime: Math.round(DateTime.fromISO(deposit.depositDate.toISOString()).toSeconds()),
    status: deposit.status,
    filled: deposit.filled,
    sourceChainId: deposit.sourceChainId,
    destinationChainId: deposit.destinationChainId,
    assetAddr: deposit.tokenAddr,
    amount: deposit.amount,
    depositTxHash: deposit.depositTxHash,
    fillTxs: deposit.fillTxs.map(({ hash }) => hash),
  };
}
