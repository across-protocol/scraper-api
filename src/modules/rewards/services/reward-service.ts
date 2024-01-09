import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { Deposit } from "../../deposit/model/deposit.entity";
import { formatDeposit } from "../../deposit/utils";
import { DepositsMvWithRewards } from "../../deposit/model/DepositsMv.entity";
import { ReferralService } from "../../referral/services/service";
import { assertValidAddress } from "../../../utils";

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
import { ReferralRewardsService } from "./referral-rewards-service";
import { ReferralRewardsWindowJobResult } from "../model/RewardsWindowJobResult.entity";
import { AppConfig } from "../../configuration/configuration.service";

@Injectable()
export class RewardService {
  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(OpReward) readonly opRewardRepository: Repository<OpReward>,
    @InjectRepository(RewardsWindowJob) readonly rewardsWindowJobRepository: Repository<RewardsWindowJob>,
    @InjectRepository(ReferralRewardsWindowJobResult)
    readonly referralRewardsWindowJobResultRepository: Repository<ReferralRewardsWindowJobResult>,
    private dataSource: DataSource,
    private referralService: ReferralService,
    private referralRewardsService: ReferralRewardsService,
    private opRebateService: OpRebateService,
    private appConfig: AppConfig,
  ) {}

  public async getEarnedRewards(query: GetSummaryQuery) {
    const { userAddress } = query;
    const [opRewards, referralRewards] = await Promise.all([
      this.opRebateService.getEarnedRewards(userAddress),
      this.referralService.getEarnedRewards(userAddress),
    ]);

    return {
      "op-rebates": opRewards,
      referrals: referralRewards,
    };
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

  public async getOpRebatesSummary(query: GetSummaryQuery) {
    return this.opRebateService.getOpRebatesSummary(query.userAddress);
  }

  public async getReferralRewardDeposits(query: GetRewardsQuery) {
    const { referrals, pagination } = await this.referralService.getReferralsWithJoinedDeposit(
      query.userAddress,
      parseInt(query.limit || "10"),
      parseInt(query.offset || "0"),
    );
    return {
      deposits: referrals.map((referral) => ({
        ...formatDeposit(referral.deposit),
        rewards: this.formatReferral(referral, query.userAddress),
      })),
      pagination,
    };
  }

  public async getReferralRewardsSummary(query: GetReferralRewardsSummaryQuery) {
    return this.referralService.getReferralSummaryHandler({
      ...query,
      address: query.userAddress,
    });
  }

  public async getRewardsForDepositsAndUserAddress(deposits: Deposit[], userAddress: string) {
    const depositPrimaryKeys = deposits.map((deposit) => deposit.id);
    const [opRebateRewards, referralRewards] = await Promise.all([
      this.opRebateService.getOpRebateRewardsForDepositPrimaryKeys(depositPrimaryKeys),
      this.referralService.getReferralsForDepositsAndUserAddress(depositPrimaryKeys, userAddress),
    ]);
    return {
      "op-rebates": opRebateRewards,
      referrals: referralRewards,
    };
  }

  public enrichDepositsWithRewards(
    userAddress: string,
    deposits: Deposit[],
    rewards: {
      "op-rebates": OpReward[];
      referrals: DepositsMvWithRewards[];
    },
  ) {
    return deposits.map((deposit) => {
      const opRebate = rewards["op-rebates"].find((reward) => reward.depositPrimaryKey === deposit.id);
      const referral = rewards["referrals"].find((reward) => reward.id === deposit.id);

      return {
        deposit,
        // We assume that a deposit can only have one type of reward here. If this changes in the future for
        // other types of rewards, we will need to change this logic.
        rewards: opRebate
          ? this.formatOpRebate(opRebate)
          : referral
          ? this.formatReferral(referral, userAddress)
          : undefined,
      };
    });
  }

  public formatOpRebate(reward: OpReward) {
    return {
      type: "op-rebates",
      rate: reward.metadata.rate,
      amount: reward.amount,
      usd: reward.amountUsd,
    };
  }

  public formatReferral(referral: DepositsMvWithRewards, userAddress: string) {
    userAddress = assertValidAddress(userAddress);
    const userRate =
      referral.depositorAddr === userAddress && referral.referralAddress === userAddress
        ? 1
        : referral.depositorAddr === userAddress
        ? 0.25
        : 0.75;
    return {
      type: "referrals",
      tier: this.referralService.getTierLevelByRate(Number(referral.referralRate)),
      rate: new BigNumber(userRate).multipliedBy(referral.referralRate).multipliedBy(referral.multiplier).toNumber(),
      userRate,
      referralRate: Number(referral.referralRate),
      multiplier: referral.multiplier,
      amount: referral.acxRewards,
      usd: new BigNumber(referral.acxUsdPrice)
        .multipliedBy(ethers.utils.formatUnits(referral.acxRewards, 18))
        .toFixed(),
    };
  }

  public async createRewardsWindowJob(body: CreateRewardsWindowJobBody) {
    const { maxDepositDate, rewardsType, windowIndex } = body;
    const typedRewardsType = rewardsType as RewardsType;
    let job = await this.createNewRewardsWindowJob(windowIndex, new Date(maxDepositDate), typedRewardsType);
    job = await this.updateReferralRewardsWindowJob(job.id, { status: RewardsWindowJobStatus.InProgress });

    const start = new Date().getTime();
    let promise: Promise<void> = undefined;

    if (typedRewardsType === RewardsType.ReferralRewards) {
      promise = this.referralRewardsService.computeReferralRewardsForWindow(
        job.id,
        windowIndex,
        new Date(maxDepositDate),
      );
    } else if (typedRewardsType === RewardsType.OpRewards) {
      promise = this.opRebateService.setWindowForOpRewards(job.id, windowIndex, new Date(maxDepositDate));
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
      metadata: {
        amountBreakdown: {
          referralRewards: result.amount,
        },
      },
    }));

    return {
      job,
      result: {
        chainId: "TODO",
        contractAddress: "TODO",
        windowIndex: job.windowIndex,
        rewardToken: "TODO",
        rewardsToDeposit: jobResults[0]?.totalRewardsAmount || null,
        recipients,
      },
    };
  }
}
