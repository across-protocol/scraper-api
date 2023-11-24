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
import { GetDepositsV2Query, GetDepositsForTxPageQuery, GetDepositsBaseQuery } from "./entry-point/http/dto";
import { formatDeposit } from "./utils";
import { RewardService } from "../rewards/services/reward-service";

export const DEPOSITS_STATS_CACHE_KEY = "deposits:stats";

@Injectable()
export class DepositService {
  constructor(
    private appConfig: AppConfig,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
    private rewardService: RewardService,
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

  public async getDepositsForTxPage(query: Partial<GetDepositsForTxPageQuery>) {
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");

    let queryBuilder = this.depositRepository.createQueryBuilder("d");
    queryBuilder = this.getFilteredDepositsQuery(queryBuilder, query);
    queryBuilder = this.getJoinedDepositsQuery(queryBuilder, query);

    // If this flag is set to true, we will skip pending deposits that:
    // - are older than 1 day because the relayer will ignore such deposits using its fixed lookback
    // - or are unprofitable for the relayer
    if (query.skipOldUnprofitable) {
      queryBuilder = queryBuilder.andWhere(
        `
        CASE
          WHEN d.status = 'filled' THEN true
          WHEN d.status = 'pending'
            AND d.depositDate <= NOW() - INTERVAL '1 days'
              THEN false
          WHEN d.status = 'pending'
            AND d.depositRelayerFeePct * :multiplier < d.suggestedRelayerFeePct 
              THEN false
          ELSE true
        END
        `,
        {
          multiplier: this.appConfig.values.suggestedFees.deviationBufferMultiplier,
        },
      );
    }

    // show pending first
    if (query.orderBy === "status") {
      queryBuilder = queryBuilder.addOrderBy("d.status", "DESC");
    }

    queryBuilder = queryBuilder.addOrderBy("d.depositDate", "DESC");
    queryBuilder = queryBuilder.take(limit);
    queryBuilder = queryBuilder.skip(offset);

    const [deposits, total] = await queryBuilder.getManyAndCount();

    // Only include rewards if a user address is provided
    if (query.depositorOrRecipientAddress) {
      const userAddress = this.assertValidAddress(query.depositorOrRecipientAddress);
      const rewards = await this.rewardService.getRewardsForDepositsAndUserAddress(deposits, userAddress);
      const enrichedDeposits = this.rewardService.enrichDepositsWithRewards(deposits, rewards);
      return {
        deposits: enrichedDeposits.map(({ deposit, rewards }) => {
          return {
            ...formatDeposit(deposit),
            rewards,
          };
        }),
        pagination: {
          limit,
          offset,
          total,
        },
      };
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

  public async getUserDeposits(userAddress: string, status?: "filled" | "pending", limit = 10, offset = 0) {
    try {
      userAddress = utils.getAddress(userAddress);
    } catch (error) {
      throw new InvalidAddressException();
    }

    let query = this.depositRepository.createQueryBuilder("d");
    query = query.where("d.depositDate is not null");
    query = query.andWhere(
      new Brackets((qb) => {
        qb.where("d.depositorAddr = :userAddress", {
          userAddress,
        }).orWhere("d.recipientAddr = :userAddress", { userAddress });
      }),
    );

    if (status) {
      query = query.andWhere("d.status = :status", { status });
    }

    query = query.orderBy("d.depositDate", "DESC");
    query = query.take(limit);
    query = query.skip(offset);

    const [userDeposits, total] = await query.getManyAndCount();

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

  public async getDepositsV2(query: GetDepositsV2Query) {
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");

    let queryBuilder = this.depositRepository.createQueryBuilder("d");
    queryBuilder = this.getFilteredDepositsQuery(queryBuilder, query);
    queryBuilder = this.getJoinedDepositsQuery(queryBuilder, query);

    queryBuilder = queryBuilder.orderBy("d.depositDate", "DESC");
    queryBuilder = queryBuilder.take(limit);
    queryBuilder = queryBuilder.skip(offset);

    const [deposits, total] = await queryBuilder.getManyAndCount();

    return {
      deposits: deposits.map(formatDeposit),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  public async getPendingDeposits(limit = 10, offset = 0) {
    // filter out pending deposits older than 1 day because the relayer will ignore such deposits using its fixed lookback
    const [deposits, total] = await this.depositRepository
      .createQueryBuilder("d")
      .where("d.status = :status", { status: "pending" })
      .andWhere("d.amount > 0")
      .andWhere("d.depositDate > NOW() - INTERVAL '1 days'")
      .andWhere(`d.depositRelayerFeePct * :multiplier >= d.suggestedRelayerFeePct`, {
        multiplier: this.appConfig.values.suggestedFees.deviationBufferMultiplier,
      })
      .orderBy("d.depositDate", "DESC")
      .take(limit)
      .skip(offset)
      .getManyAndCount();

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

  private getFilteredDepositsQuery(
    queryBuilder: ReturnType<typeof this.depositRepository.createQueryBuilder>,
    filter: Partial<GetDepositsBaseQuery>,
  ) {
    queryBuilder = queryBuilder.andWhere("d.depositDate is not null");

    if (filter.status) {
      queryBuilder = queryBuilder.andWhere("d.status = :status", { status: filter.status });
    }

    if (filter.originChainId) {
      queryBuilder = queryBuilder.andWhere("d.sourceChainId = :sourceChainId", { sourceChainId: filter.originChainId });
    }

    if (filter.destinationChainId) {
      queryBuilder = queryBuilder.andWhere("d.destinationChainId = :destinationChainId", {
        destinationChainId: filter.destinationChainId,
      });
    }

    if (filter.tokenAddress) {
      queryBuilder = queryBuilder.andWhere("d.tokenAddr = :tokenAddr", { tokenAddr: filter.tokenAddress });
    }

    if (filter.depositorOrRecipientAddress) {
      const depositorOrRecipientAddress = this.assertValidAddress(filter.depositorOrRecipientAddress);
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("d.depositorAddr = :depositorOrRecipientAddress", {
            depositorOrRecipientAddress,
          }).orWhere("d.recipientAddr = :depositorOrRecipientAddress", { depositorOrRecipientAddress });
        }),
      );
    } else {
      if (filter.depositorAddress) {
        const depositorAddress = this.assertValidAddress(filter.depositorAddress);
        queryBuilder = queryBuilder.andWhere("d.depositorAddr = :depositorAddr", { depositorAddr: depositorAddress });
      }

      if (filter.recipientAddress) {
        const recipientAddress = this.assertValidAddress(filter.recipientAddress);
        queryBuilder = queryBuilder.andWhere("d.recipientAddr = :recipientAddr", { recipientAddr: recipientAddress });
      }
    }

    if (filter.startDepositDate) {
      queryBuilder = queryBuilder.andWhere("d.depositDate >= :startDepositDate", {
        startDepositDate: new Date(filter.startDepositDate),
      });
    }

    if (filter.endDepositDate) {
      queryBuilder = queryBuilder.andWhere("d.depositDate <= :endDepositDate", {
        endDepositDate: new Date(filter.endDepositDate),
      });
    }

    return queryBuilder;
  }

  private getJoinedDepositsQuery(
    queryBuilder: ReturnType<typeof this.depositRepository.createQueryBuilder>,
    filter: Partial<GetDepositsV2Query | GetDepositsForTxPageQuery>,
  ) {
    if (!filter.include) {
      return queryBuilder;
    }

    if (filter.include.includes("token")) {
      queryBuilder = queryBuilder.leftJoinAndSelect("d.token", "token");
    }

    return queryBuilder;
  }

  private assertValidAddress(address: string) {
    try {
      const validAddress = utils.getAddress(address);
      return validAddress;
    } catch (error) {
      throw new InvalidAddressException();
    }
  }
}
