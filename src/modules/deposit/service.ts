import { DateTime } from "luxon";
import { CACHE_MANAGER, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, Repository } from "typeorm";
import { utils } from "ethers";
import { Cache } from "cache-manager";
import { Deposit } from "./model/deposit.entity";
import {
  getAvgFillTimeQuery,
  getReferralsForEtl,
  getTotalDepositsQuery,
  getTotalVolumeQuery,
} from "./adapter/db/queries";
import { AppConfig } from "../configuration/configuration.service";
import { InvalidAddressException, DepositNotFoundException } from "./exceptions";

export const DEPOSITS_STATS_CACHE_KEY = "deposits:stats";

@Injectable()
export class DepositService {
  constructor(
    private appConfig: AppConfig,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
  ) {}

  public async getCachedGeneralStats() {
    let data = await this.cacheManager.get(DEPOSITS_STATS_CACHE_KEY);

    if (!data) {
      const [totalVolumeResult, totalDepositsResult, avgFillTime] = await Promise.all([
        this.depositRepository.query(getTotalVolumeQuery()),
        this.depositRepository.query(getTotalDepositsQuery()),
        this.depositRepository.query(getAvgFillTimeQuery()),
      ]);
      data = {
        totalDeposits: parseInt(totalDepositsResult[0]["totalDeposits"]) + 13_955,
        totalVolumeUsd: parseInt(totalVolumeResult[0]["totalVolumeUsd"]) + 264_950_594.44,
        avgFillTime: parseInt(avgFillTime[0]["avgFillTime"]),
      };
      await this.cacheManager.set(DEPOSITS_STATS_CACHE_KEY, data, 60);
    }
    return data;
  }

  public async getUserDeposits(userAddress: string, status?: "filled" | "pending", limit = 10, offset = 0) {
    let userDeposits: Deposit[] = [];
    let total = 0;

    try {
      userAddress = utils.getAddress(userAddress);
    } catch (error) {
      throw new InvalidAddressException();
    }

    if (status) {
      [userDeposits, total] = await this.depositRepository
        .createQueryBuilder("d")
        .where("d.status = :status", { status })
        .andWhere("d.depositDate is not null")
        .andWhere(
          new Brackets((qb) => {
            qb.where("d.depositorAddr = :userAddress", {
              userAddress,
            }).orWhere("d.recipientAddr = :userAddress", { userAddress });
          }),
        )
        .orderBy("d.depositDate", "DESC")
        .take(limit)
        .skip(offset)
        .getManyAndCount();
    } else {
      [userDeposits, total] = await this.depositRepository
        .createQueryBuilder("d")
        .andWhere("d.depositDate is not null")
        .andWhere(
          new Brackets((qb) => {
            qb.where("d.depositorAddr = :userAddress", {
              userAddress,
            }).orWhere("d.recipientAddr = :userAddress", { userAddress });
          }),
        )
        .orderBy("d.depositDate", "DESC")
        .take(limit)
        .skip(offset)
        .getManyAndCount();
    }

    return {
      deposits: userDeposits.map(formatDeposit),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  public async getDeposits(status: "filled" | "pending", limit = 10, offset = 0) {
    let deposits: Deposit[] = [];
    let total = 0;

    if (status === "filled") {
      [deposits, total] = await this.depositRepository
        .createQueryBuilder("d")
        .where("d.status = :status", { status })
        .andWhere("d.depositDate is not null")
        .orderBy("d.depositDate", "DESC")
        .take(limit)
        .skip(offset)
        .getManyAndCount();
    } else if (status === "pending") {
      // filter out pending deposits older than 1 day because the relayer will ignore such deposits using its fixed lookback
      [deposits, total] = await this.depositRepository
        .createQueryBuilder("d")
        .where("d.status = :status", { status })
        .andWhere("d.amount > 0")
        .andWhere("d.depositDate > NOW() - INTERVAL '1 days'")
        .andWhere(`d.depositRelayerFeePct * :multiplier >= d.suggestedRelayerFeePct`, {
          multiplier: this.appConfig.values.suggestedFees.deviationBufferMultiplier,
        })
        .orderBy("d.depositDate", "DESC")
        .take(limit)
        .skip(offset)
        .getManyAndCount();
    } else {
      [deposits, total] = await this.depositRepository
        .createQueryBuilder("d")
        .where("d.depositDate is not null")
        .orderBy("d.depositDate", "DESC")
        .take(limit)
        .skip(offset)
        .getManyAndCount();
    }

    return {
      deposits: deposits.map(formatDeposit),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  public async getDepositDetails(depositTxHash: string, sourceChainId: number) {
    const deposit = await this.depositRepository.findOne({ where: { depositTxHash, sourceChainId } });

    if (!deposit) {
      throw new DepositNotFoundException();
    }

    return deposit;
  }

  public async getEtlReferralDeposits(date: string) {
    // delete time from date in case of datetime
    const parsedDate = new Date(date).toISOString().split("T")[0];
    const query = getReferralsForEtl();
    const data = await this.dataSource.query(query, [parsedDate]);

    return data.map((d) => ({
      deposit_id: d.depositId,
      origin_chain_id: d.sourceChainId,
      applied_referrer: d.referralAddress,
      multiplier: d.multiplier,
      referral_rate: Number(d.referralRate),
      bridge_fee_usd: d.bridgeFeeUsd,
      acx_usd_price: Number(d.acxUsdPrice),
      acx_rewards_amount: d.acxRewards,
      acx_rewards_amount_referrer: d.acxRewardsAmountReferrer,
      acx_rewards_amount_referee: d.acxRewardsAmountReferee,
    }));
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
    depositorAddr: deposit.depositorAddr,
    recipientAddr: deposit.recipientAddr,
    message: deposit.message,
    amount: deposit.amount,
    depositTxHash: deposit.depositTxHash,
    fillTxs: deposit.fillTxs.map(({ hash }) => hash),
    speedUps: deposit.speedUps,
    depositRelayerFeePct: deposit.depositRelayerFeePct,
    initialRelayerFeePct: deposit.initialRelayerFeePct,
    suggestedRelayerFeePct: deposit.suggestedRelayerFeePct,
  };
}
