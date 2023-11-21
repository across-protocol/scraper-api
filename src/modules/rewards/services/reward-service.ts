import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";

import { Deposit } from "../../deposit/model/deposit.entity";
import { DepositsMv } from "../../deposit/model/DepositsMv.entity";
import { ReferralService } from "../../referral/services/service";

import { OpRebateService } from "./op-rebate-service";
import { Reward } from "../model/reward.entity";

type Referral = DepositsMv & { appliedRate: number; acxRewards: string };

@Injectable()
export class RewardService {
  constructor(
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    @InjectRepository(Reward) readonly rewardRepository: Repository<Reward>,
    private referralService: ReferralService,
    private opRebateService: OpRebateService,
  ) {}

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
    deposits: Deposit[],
    rewards: {
      "op-rebates": Reward[];
      referrals: Referral[];
    },
  ) {
    return deposits.map((deposit) => {
      const opRebate = rewards["op-rebates"].find((reward) => reward.depositPrimaryKey === deposit.id);
      const referral = rewards["referrals"].find((reward) => reward.id === deposit.id);

      return {
        deposit,
        rewards: opRebate ? this.formatOpRebate(opRebate) : referral ? this.formatReferral(referral) : undefined,
      };
    });
  }

  public formatOpRebate(reward: Reward) {
    return {
      type: "op-rebates",
      rate: reward.metadata.rate,
      amount: reward.amount,
      usd: reward.amountUsd,
    };
  }

  public formatReferral(referral: Referral) {
    return {
      type: "referrals",
      tier: this.referralService.getTierLevelByRate(referral.referralRate),
      rate: referral.appliedRate,
      referralRate: referral.referralRate,
      multiplier: referral.multiplier,
      amount: referral.acxRewards,
      usd: new BigNumber(referral.acxUsdPrice)
        .multipliedBy(ethers.utils.formatUnits(referral.acxRewards, 18))
        .toFixed(),
    };
  }
}
