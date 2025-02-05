import { BadRequestException, CACHE_MANAGER, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, In, LessThanOrEqual, Repository } from "typeorm";
import { utils } from "ethers";
import { Cache } from "cache-manager";
import BigNumber from "bignumber.js";

import { Deposit } from "./model/deposit.entity";
import {
  getAvgFillTimeQuery,
  getMedianFillTimeQuery,
  getReferralsForEtl,
  getTotalDepositsQuery,
  getTotalVolumeQuery,
} from "./adapter/db/queries";
import { AppConfig } from "../configuration/configuration.service";
import { InvalidAddressException, DepositNotFoundException } from "./exceptions";
import {
  GetDepositsV2Query,
  GetDepositsForTxPageQuery,
  GetDepositsBaseQuery,
  GetDepositStatusQuery,
} from "./entry-point/http/dto";
import { formatDeposit } from "./utils";
import { RewardService } from "../rewards/services/reward-service";
import { Block } from "../web3/model/block.entity";
import { ChainIds } from "../web3/model/ChainId";
import { SetPoolRebalanceRouteEvent } from "../web3/model/SetPoolRebalanceRouteEvent.entity";

export const DEPOSITS_STATS_CACHE_KEY = "deposits:stats";

const depositStatusCacheKey = (originChainId: number, depositId: number) =>
  `deposit-status:${depositId}:${originChainId}`;

@Injectable()
export class DepositService {
  constructor(
    private appConfig: AppConfig,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(Block) private blockRepository: Repository<Block>,
    @InjectRepository(SetPoolRebalanceRouteEvent)
    private setPoolRebalanceRouteRepository: Repository<SetPoolRebalanceRouteEvent>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
    private rewardService: RewardService,
  ) {}

  public async deriveOutputTokenAddress(
    originChainId: number,
    inputTokenAddress: string,
    destinationChainId: number,
    quoteTimestamp: number) {
    const quoteDatetime = new Date(quoteTimestamp * 1000);
    const inputTokenRebalanceRoute = await this.setPoolRebalanceRouteRepository.findOne({
      where: {
        destinationChainId: originChainId,
        destinationToken: inputTokenAddress,
        date: LessThanOrEqual(quoteDatetime),
      },
      order: {
        blockNumber: "DESC",
      },
    });
    const l1Token = inputTokenRebalanceRoute.l1Token;
    const outputTokenRebalanceRoute = await this.setPoolRebalanceRouteRepository.findOne({
      where: {
        destinationChainId,
        l1Token,
        date: LessThanOrEqual(quoteDatetime),
      },
      order: {
        blockNumber: "DESC",
      },
    });

    if (!outputTokenRebalanceRoute) {
      throw new Error(`Output token not found for ${l1Token} on chain ${destinationChainId}`);
    }

    return outputTokenRebalanceRoute.destinationToken;
  }

  public async getCachedGeneralStats() {
    let data = await this.cacheManager.get(DEPOSITS_STATS_CACHE_KEY);

    if (!data) {
      const [totalVolumeResult, totalDepositsResult, avgFillTime, medianFillTime] = await Promise.all([
        this.depositRepository.query(getTotalVolumeQuery()),
        this.depositRepository.query(getTotalDepositsQuery()),
        this.depositRepository.query(getAvgFillTimeQuery()),
        this.depositRepository.query(getMedianFillTimeQuery()),
      ]);
      data = {
        totalDeposits: parseInt(totalDepositsResult[0]["totalDeposits"]) + 13_955,
        totalVolumeUsd: parseInt(totalVolumeResult[0]["totalVolumeUsd"]) + 264_950_594.44,
        avgFillTime: parseInt(avgFillTime[0]["avgFillTime"]),
        medianFillTime: parseInt(medianFillTime[0]["medianFillTime"]),
      };
      await this.cacheManager.set(DEPOSITS_STATS_CACHE_KEY, data, 60 * 30);
    }
    return data;
  }

  public async getDepositsForTxPage(query: Partial<GetDepositsForTxPageQuery>) {
    const limit = parseInt(query.limit ?? "10");
    const offset = parseInt(query.offset ?? "0");

    if (!query.include?.includes("token")) {
      return {
        deposits: [],
        pagination: {
          limit,
          offset,
          total: 0,
        },
      };
    }

    if (offset >= 1500) {
      throw new BadRequestException({
        error: "BadRequestException",
        message: "Currently the offset is temporarily limited to 2500",
      });
    }

    let queryBuilder = this.dataSource.createQueryBuilder().select(["d.id"]).from(Deposit, "d");
    queryBuilder = queryBuilder.andWhere("d.depositDate is not null");
    if (query.status) {
      queryBuilder = queryBuilder.andWhere("d.status = :status", { status: query.status });
    }
    if (query.depositorOrRecipientAddress) {
      const depositorOrRecipientAddress = this.assertValidAddress(query.depositorOrRecipientAddress);
      queryBuilder = queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("d.depositorAddr = :depositorOrRecipientAddress", {
            depositorOrRecipientAddress,
          }).orWhere("d.recipientAddr = :depositorOrRecipientAddress", { depositorOrRecipientAddress });
        }),
      );
    }

    // if (!query.depositorOrRecipientAddress) {
    //   queryBuilder = queryBuilder.andWhere(
    //     `
    //     CASE
    //       WHEN d.status = 'pending' AND d.depositDate <= NOW() - INTERVAL '1 days'
    //           THEN false
    //       WHEN d.status = 'pending' AND d.depositRelayerFeePct * :multiplier < d.suggestedRelayerFeePct 
    //           THEN false
    //       ELSE true
    //     END`,
    //     {
    //       multiplier: this.appConfig.values.suggestedFees.deviationBufferMultiplier,
    //     },
    //   );
    // }

    queryBuilder = queryBuilder.addOrderBy("d.status", "DESC");
    queryBuilder = queryBuilder.addOrderBy("d.depositDate", "DESC");
    queryBuilder = queryBuilder.take(limit);
    queryBuilder = queryBuilder.skip(offset);

    const [rawDeposits, total] = await queryBuilder.getManyAndCount();
    const depositIds = rawDeposits.map((d) => d.id);
    const deposits = await this.depositRepository.find({
      where: { id: In(depositIds) },
      relations: ["token", "outputToken", "swapToken"],
    });

    deposits.sort((a, b) => {
      if (a.status === b.status) {
        return b.depositDate.getTime() - a.depositDate.getTime();
      }
      return a.status === "pending" ? -1 : 1;
    });

    if (query.depositorOrRecipientAddress) {
      const userAddress = this.assertValidAddress(query.depositorOrRecipientAddress);
      const rewards = await this.rewardService.getRewardsForDepositsAndUserAddress(deposits);
      const enrichedDeposits = this.rewardService.enrichDepositsWithRewards(userAddress, deposits, rewards);
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

    const userDeposits = await query.getMany();

    return {
      deposits: userDeposits.map(formatDeposit),
      pagination: {
        limit,
        offset,
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

  public async getDepositStatus(query: GetDepositStatusQuery) {
    const depositId = parseInt(query.depositId);
    const originChainId = parseInt(query.originChainId);
    const cachedData = await this.cacheManager.get(depositStatusCacheKey(originChainId, depositId));

    if (cachedData) return cachedData;

    const deposit = await this.depositRepository.findOne({
      where: { depositId, sourceChainId: originChainId },
      select: ["fillTxs", "status", "fillDeadline", "destinationChainId"],
    });

    if (!deposit) throw new DepositNotFoundException();

    let status = "filled";
    const now = new Date();

    if (deposit.status === "pending") {
      status = deposit.fillDeadline < now ? "expired" : "pending";
    }

    const data = {
      depositId,
      originChainId,
      status,
      fillTx: deposit.fillTxs.length > 0 ? deposit.fillTxs[0].hash : null,
      destinationChainId: deposit.destinationChainId,
    };

    if (status === "filled" || status === "expired") {
      // cache filled and expired deposits for 10 minutes
      await this.cacheManager.set(depositStatusCacheKey(originChainId, depositId), data, 60 * 10);
    }

    return data;
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

  public computeBridgeFeeForV3Deposit(deposit: Deposit) {
    if (!deposit.token) throw new Error("[computeBridgeFeeForV3Deposit] Token not found");
    if (!deposit.outputToken) throw new Error("[computeBridgeFeeForV3Deposit] Output token not found");
    if (!deposit.price) throw new Error("[computeBridgeFeeForV3Deposit] Price not found");
    if (!deposit.outputTokenPrice) throw new Error("[computeBridgeFeeForV3Deposit] Output token price not found");

    let inputTokenPrice = deposit.price.usd;
    let outputTokenPrice = deposit.outputTokenPrice.usd;

    if (
      deposit.sourceChainId === ChainIds.blast &&
      deposit.token.symbol === "USDB" &&
      deposit.outputToken.symbol === "DAI"
    ) {
      inputTokenPrice = outputTokenPrice;
    }

    if (
      deposit.destinationChainId === ChainIds.blast &&
      deposit.outputToken.symbol === "USDB" &&
      deposit.token.symbol === "DAI"
    ) {
      outputTokenPrice = inputTokenPrice;
    }

    const wei = new BigNumber(10).pow(18);
    const inputAmountUsd = new BigNumber(deposit.amount)
      .multipliedBy(inputTokenPrice)
      .dividedBy(new BigNumber(10).pow(deposit.token.decimals));
    const outputAmountUsd = new BigNumber(deposit.outputAmount)
      .multipliedBy(outputTokenPrice)
      .dividedBy(new BigNumber(10).pow(deposit.outputToken.decimals));
    const fraction = outputAmountUsd.multipliedBy(wei).dividedBy(inputAmountUsd);
    const bridgeFeePct = wei.minus(fraction);
    const bridgeFeeUsd = inputAmountUsd.minus(outputAmountUsd);
    // bridge fee in input token giving the bridge fee usd and token price and decimals
    const bridgeFeeAmount = bridgeFeeUsd
      .multipliedBy(new BigNumber(10).pow(deposit.token.decimals))
      .dividedBy(inputTokenPrice);

    return {
      bridgeFeePct,
      bridgeFeeUsd,
      bridgeFeeAmount,
    };
  }

  public getFirstDepositIdFromSpokePoolConfig(chainId: number, throwIfNotFound = true) {
    const contracts = this.appConfig.values.web3.spokePoolContracts[chainId];
    if (!contracts && throwIfNotFound) {
      throw new Error(`SpokePool contracts for chainId ${chainId} not found`);
    }
    if (!contracts) return undefined;

    const firstDepositIds = contracts.map((contract) => contract.firstDepositId);
    return Math.min(...firstDepositIds);
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
    filter: Partial<GetDepositsV2Query>,
  ) {
    if (!filter.include) {
      return queryBuilder;
    }

    if (filter.include.includes("token")) {
      queryBuilder = queryBuilder.leftJoinAndSelect("d.token", "token");
      queryBuilder = queryBuilder.leftJoinAndSelect("d.outputToken", "outputToken");
      queryBuilder = queryBuilder.leftJoinAndSelect("d.swapToken", "swapToken");
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
