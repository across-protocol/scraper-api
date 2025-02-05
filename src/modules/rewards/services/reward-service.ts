import { CACHE_MANAGER, Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Cache } from "cache-manager";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { Deposit } from "../../deposit/model/deposit.entity";
import { formatDeposit } from "../../deposit/utils";

import { ReferralService } from "../../referral/services/service";

import { ArbReward } from "../model/arb-reward.entity";
import { ArbRebateService } from "./arb-rebate-service";
import { OpRebateService } from "./op-rebate-service";
import { OpReward } from "../model/op-reward.entity";
import {
  GetRewardsQuery,
  GetSummaryQuery,
  GetReferralRewardsSummaryQuery,
  CreateRewardsWindowJobBody,
} from "../entrypoints/http/dto";
import { RewardsType, RewardsWindowJob, RewardsWindowJobStatus } from "../model/RewardsWindowJob.entity";
import { InvalidRewardsWindowJobException, RewardsWindowJobNotFoundException } from "./exceptions";
import { ReferralRewardsWindowJobResult } from "../model/RewardsWindowJobResult.entity";
import { AppConfig } from "../../configuration/configuration.service";

// Cache Keys
const getArbRebatesSummaryCacheKey = (address: string) => `arbRebates:summary:${address}`;
const getOpRebatesSummaryCacheKey = (address: string) => `opRebates:summary:${address}`;
const getOpRebatesStatsCacheKey = () => `opRebates:stats`;
const getEarnedRewardsCacheKey = (address: string) => `earnedRewards:${address}`;

@Injectable()
export class RewardService {
  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(ArbReward) readonly arbRewardRepository: Repository<ArbReward>,
    @InjectRepository(OpReward) readonly opRewardRepository: Repository<OpReward>,
    @InjectRepository(RewardsWindowJob) readonly rewardsWindowJobRepository: Repository<RewardsWindowJob>,
    @InjectRepository(ReferralRewardsWindowJobResult)
    readonly referralRewardsWindowJobResultRepository: Repository<ReferralRewardsWindowJobResult>,
    private dataSource: DataSource,
    private arbRebateService: ArbRebateService,
    private opRebateService: OpRebateService,
    private referralService: ReferralService,
    private appConfig: AppConfig,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  public async getEarnedRewards(query: GetSummaryQuery) {
    const { userAddress } = query;

    let data = await this.cacheManager.get(getEarnedRewardsCacheKey(userAddress));
    if (data) return data;

    const [arbRewards, opRewards, referralRewards] = await Promise.all(
      [this.arbRebateService, this.opRebateService, this.referralService].map((service) =>
        service.getEarnedRewards(userAddress),
      ),
    );

    data = {
      "arb-rebates": arbRewards,
      "op-rebates": opRewards,
      referrals: referralRewards,
    };

    if (this.appConfig.values.app.cacheDuration.rebatesData) {
      await this.cacheManager.set(
        getEarnedRewardsCacheKey(userAddress),
        data,
        this.appConfig.values.app.cacheDuration.earnedRewards,
      );
    }

    return data;
  }

  public async getArbRebateRewardDeposits(query: GetRewardsQuery) {
    const { rewards, pagination } = await this.arbRebateService.getArbRebateRewards(query);
    return {
      deposits: rewards.map((reward) => ({
        ...formatDeposit(reward.deposit),
        rewards: this.formatArbRebate(reward),
      })),
      pagination,
    };
  }

  public async getArbRebatesSummary(query: GetSummaryQuery) {
    const { userAddress } = query;

    let data = await this.cacheManager.get(getArbRebatesSummaryCacheKey(userAddress));
    if (data) return data;

    data = await this.arbRebateService.getArbRebatesSummary(userAddress);

    if (this.appConfig.values.app.cacheDuration.rebatesData) {
      await this.cacheManager.set(
        getArbRebatesSummaryCacheKey(userAddress),
        data,
        this.appConfig.values.app.cacheDuration.rebatesData,
      );
    }

    return data;
  }

  public async getOpRebateRewardDeposits(query: GetRewardsQuery) {
    const { rewards, pagination } = await this.opRebateService.getOpRebateRewards(query);
    return {
      deposits: rewards.map((reward) => ({
        ...formatDeposit(reward.deposit),
        rewards: this.formatOpRebate(reward),
      })),
      pagination,
    };
  }

  public async getOpRebatesStats() {
    let data = await this.cacheManager.get(getOpRebatesStatsCacheKey());
    if (data) return data;

    data = await this.opRebateService.getOpRebatesStats();

    if (this.appConfig.values.app.cacheDuration.rebatesData) {
      await this.cacheManager.set(
        getOpRebatesStatsCacheKey(),
        data,
        60,
      );
    }

    return data;
  }

  public async getOpRebatesSummary(query: GetSummaryQuery) {
    const { userAddress } = query;

    let data = await this.cacheManager.get(getOpRebatesSummaryCacheKey(userAddress));
    if (data) return data;

    data = await this.opRebateService.getOpRebatesSummary(userAddress);

    if (this.appConfig.values.app.cacheDuration.rebatesData) {
      await this.cacheManager.set(
        getOpRebatesSummaryCacheKey(userAddress),
        data,
        this.appConfig.values.app.cacheDuration.rebatesData,
      );
    }

    return data;
  }

  public async getReferralRewardsSummary(query: GetReferralRewardsSummaryQuery) {
    return this.referralService.getReferralSummaryHandler({
      ...query,
      address: query.userAddress,
    });
  }

  public async getRewardsForDepositsAndUserAddress(deposits: Deposit[]) {
    const depositPrimaryKeys = deposits.map((deposit) => deposit.id);
    const [opRebateRewards, arbRebateRewards] = await Promise.all([
      this.opRebateService.getOpRebateRewardsForDepositPrimaryKeys(depositPrimaryKeys),
      this.arbRebateService.getArbRebateRewardsForDepositPrimaryKeys(depositPrimaryKeys),
    ]);
    return {
      "op-rebates": opRebateRewards,
      arbRebateRewards,
    };
  }

  public enrichDepositsWithRewards(
    userAddress: string,
    deposits: Deposit[],
    rewards: {
      "op-rebates": OpReward[];
      arbRebateRewards: ArbReward[];
    },
  ) {
    return deposits.map((deposit) => {
      const opRebate = rewards["op-rebates"].find((reward) => reward.depositPrimaryKey === deposit.id);
      const arbRebate = rewards.arbRebateRewards.find((reward) => reward.depositPrimaryKey === deposit.id);
      let formattedRewards;

      if (opRebate) {
        formattedRewards = this.formatOpRebate(opRebate);
      } else if (arbRebate) {
        formattedRewards = this.formatArbRebate(arbRebate);
      }

      return {
        deposit,
        // We assume that a deposit can only have one type of reward here. If this changes in the future for
        // other types of rewards, we will need to change this logic.
        rewards: formattedRewards,
      };
    });
  }

  public formatArbRebate(reward: ArbReward) {
    return {
      type: "arb-rebates",
      rate: reward.metadata.rate,
      amount: reward.amount,
      usd: reward.amountUsd,
    };
  }

  public formatOpRebate(reward: OpReward) {
    return {
      type: "op-rebates",
      rate: reward.metadata.rate,
      amount: reward.amount,
      usd: reward.amountUsd,
    };
  }

  public async createRewardsWindowJob(body: CreateRewardsWindowJobBody) {
    const { maxDepositDate, rewardsType, windowIndex } = body;
    const typedRewardsType = rewardsType as RewardsType;
    let job = await this.createNewRewardsWindowJob(windowIndex, new Date(maxDepositDate), typedRewardsType);
    job = await this.updateReferralRewardsWindowJob(job.id, { status: RewardsWindowJobStatus.InProgress });

    const start = new Date().getTime();
    let promise: Promise<void> = undefined;

    if (typedRewardsType === RewardsType.OpRewards) {
      promise = this.opRebateService.setWindowForOpRewards(job.id, windowIndex, new Date(maxDepositDate));
    } else if (typedRewardsType === RewardsType.ArbRewards) {
      promise = this.arbRebateService.setWindowForArbRewards(job.id, windowIndex, new Date(maxDepositDate));
    } else {
      throw new Error(`Unknown rewards type: ${rewardsType}`);
    }

    promise
      .then(() => {
        const stop = new Date().getTime();
        return this.updateReferralRewardsWindowJob(job.id, {
          status: RewardsWindowJobStatus.Done,
          executionTime: `${(stop - start) / 1000}`,
        });
      })
      .catch((error) => {
        const stop = new Date().getTime();
        this.updateReferralRewardsWindowJob(job.id, {
          status: RewardsWindowJobStatus.Failed,
          error: JSON.stringify(error),
          executionTime: `${(stop - start) / 1000}`,
        });
      });

    return job;
  }

  public async createNewRewardsWindowJob(windowIndex: number, maxDepositDate: Date, rewardsType: RewardsType) {
    return this.dataSource.transaction(async (entityManager) => {
      const query = entityManager
        .createQueryBuilder()
        .select("job")
        .from(RewardsWindowJob, "job")
        .where("job.windowIndex = :windowIndex", { windowIndex })
        .where("job.rewardsType = :rewardsType", { rewardsType })
        .orderBy("job.createdAt", "DESC");
      const jobs = await query.getMany();

      if (jobs.some((job) => job.status === RewardsWindowJobStatus.Initial)) {
        throw new InvalidRewardsWindowJobException(`Job already created for window ${windowIndex}`);
      }

      if (jobs.length > 0 && jobs[0].status === RewardsWindowJobStatus.InProgress) {
        throw new InvalidRewardsWindowJobException(
          `Job in progress for window ${windowIndex}. Please wait and try again.`,
        );
      }

      // A new job for rewards window is created.
      const insertJobResult = await entityManager
        .createQueryBuilder()
        .insert()
        .into(RewardsWindowJob)
        .values({
          windowIndex,
          rewardsType,
          status: RewardsWindowJobStatus.Initial,
          config: { maxDepositDate: maxDepositDate.toISOString() },
        })
        .execute();
      const jobId = insertJobResult.identifiers[0].id;
      const job = await entityManager
        .createQueryBuilder()
        .select("job")
        .from(RewardsWindowJob, "job")
        .where("job.id = :id", { id: jobId })
        .getOne();

      return job;
    });
  }

  public async updateReferralRewardsWindowJob(id: number, values: QueryDeepPartialEntity<RewardsWindowJob>) {
    await this.dataSource.createQueryBuilder().update(RewardsWindowJob).set(values).where("id = :id", { id }).execute();

    const job = await this.dataSource
      .createQueryBuilder()
      .select("job")
      .from(RewardsWindowJob, "job")
      .where("job.id = :id", { id })
      .getOne();

    return job;
  }

  public async getRewardsWindowJob(id: number) {
    const job = await this.rewardsWindowJobRepository.findOne({ where: { id } });

    if (!job) throw new RewardsWindowJobNotFoundException(job.id);

    const jobResults = await this.referralRewardsWindowJobResultRepository.find({ where: { jobId: job.id } });

    const recipients = jobResults.map((result) => ({
      account: result.address,
      amount: result.amount,
    }));

    let chainId = undefined;
    let contractAddress = undefined;
    let rewardToken = undefined;

    if (job.rewardsType === RewardsType.ReferralRewards) {
      chainId = this.appConfig.values.web3.merkleDistributor.chainId;
      contractAddress = this.appConfig.values.web3.merkleDistributor.address;
      rewardToken = this.appConfig.values.web3.acx.address;
    } else if (job.rewardsType === RewardsType.OpRewards) {
      chainId = this.appConfig.values.web3.merkleDistributorContracts.opRewards.chainId;
      contractAddress = this.appConfig.values.web3.merkleDistributorContracts.opRewards.address;
      rewardToken = this.appConfig.values.rewardPrograms["op-rebates"].rewardToken.address;
    } else if (job.rewardsType === RewardsType.ArbRewards) {
      chainId = this.appConfig.values.web3.merkleDistributorContracts.arbRewards.chainId;
      contractAddress = this.appConfig.values.web3.merkleDistributorContracts.arbRewards.address;
      rewardToken = this.appConfig.values.rewardPrograms.arbRebates.rewardToken.address;
    }

    return {
      job,
      result: {
        chainId,
        contractAddress,
        windowIndex: job.windowIndex,
        rewardToken,
        rewardsToDeposit: jobResults[0]?.totalRewardsAmount || null,
        recipients,
      },
    };
  }
}
