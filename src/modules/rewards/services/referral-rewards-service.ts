import { Injectable } from "@nestjs/common";
import { DataSource, In } from "typeorm";
import BigNumber from "bignumber.js";

import { Deposit } from "../../deposit/model/deposit.entity";
import { DepositsMv } from "../../deposit/model/DepositsMv.entity";
import { splitArrayInChunks } from "../../../utils";

import { WindowAlreadySetException } from "./exceptions";
import { ReferralRewardsWindowJobResult } from "../model/RewardsWindowJobResult.entity";

@Injectable()
export class ReferralRewardsService {
  constructor(private dataSource: DataSource) {}

  public computeReferralRewardsForWindow(jobId: number, windowIndex: number, maxDepositDate: Date) {
    return this.dataSource.transaction(async (entityManager) => {
      const depositWithSameWindowIndex = await entityManager
        .createQueryBuilder()
        .select("d")
        .from(Deposit, "d")
        .where("d.rewardsWindowIndex = :windowIndex", { windowIndex })
        .getOne();

      if (Boolean(depositWithSameWindowIndex)) {
        throw new WindowAlreadySetException();
      }

      const deposits = await entityManager
        .createQueryBuilder(DepositsMv, "deposit")
        .where("deposit.rewardsWindowIndex IS NULL")
        .andWhere("deposit.depositDate <= :maxDepositDate", { maxDepositDate })
        .getMany();
      const { recipients, rewardsToDeposit } = this.calculateReferralRewards(deposits);
      for (const depositsChunk of splitArrayInChunks(deposits, 100)) {
        await entityManager
          .createQueryBuilder()
          .update(Deposit)
          .set({ rewardsWindowIndex: windowIndex })
          .where({ id: In(depositsChunk.map((d) => d.id)) })
          .execute();
      }

      for (const recipientsChunk of splitArrayInChunks(recipients, 100)) {
        await entityManager
          .createQueryBuilder()
          .insert()
          .into(ReferralRewardsWindowJobResult)
          .values(
            recipientsChunk.map((recipient) => ({
              jobId,
              windowIndex,
              totalRewardsAmount: rewardsToDeposit,
              address: recipient.account,
              amount: recipient.amount,
            })),
          )
          .execute();
      }
    });
  }

  public calculateReferralRewards(deposits: DepositsMv[]) {
    // Map an address to considered deposits for referral rewards
    const addressToDepositsMap = deposits.reduce((acc: Record<string, DepositsMv[]>, d) => {
      if (d.referralAddress) {
        acc[d.referralAddress] = [...(acc[d.referralAddress] || []), d];
        if (d.depositorAddr !== d.referralAddress) {
          acc[d.depositorAddr] = [...(acc[d.depositorAddr] || []), d];
        }
      }
      return acc;
    }, {});

    let rewardsToDeposit: BigNumber = new BigNumber(0);
    const recipients: {
      account: string;
      amount: string;
    }[] = [];

    for (const [address, deposits] of Object.entries(addressToDepositsMap)) {
      const acxRewards = deposits.reduce((sum, d) => {
        const feePct =
          d.depositorAddr === address && d.referralAddress === address ? 1 : d.depositorAddr === address ? 0.25 : 0.75;
        const rewards = new BigNumber(d.bridgeFeeUsd)
          .multipliedBy(d.referralRate)
          .multipliedBy(feePct)
          .multipliedBy(d.multiplier)
          .multipliedBy(new BigNumber(10).pow(18))
          .dividedBy(d.acxUsdPrice)
          .toFixed(0);
        return sum.plus(rewards);
      }, new BigNumber(0));

      rewardsToDeposit = rewardsToDeposit.plus(acxRewards);
      recipients.push({
        account: address,
        amount: acxRewards.toFixed(),
      });
    }

    return { rewardsToDeposit: rewardsToDeposit.toFixed(), recipients };
  }
}
