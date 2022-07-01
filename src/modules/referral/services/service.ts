import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Deposit } from "../../scraper/model/deposit.entity";
import BigNumber from "bignumber.js";
import {
  getReferralsQuery,
  getReferralTransfersQuery,
  getReferralVolumeQuery,
  getReferreeWalletsQuery,
  getTotalReferralRewardsQuery,
} from "./queries";
@Injectable()
export class ReferralService {
  constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {}

  public async getReferralSummary(address: string) {
    const referreeWalletsQuery = getReferreeWalletsQuery();
    const referralTransfersQuery = getReferralTransfersQuery();
    const referralVolumeQuery = getReferralVolumeQuery();
    const totalReferralRewardsQuery = getTotalReferralRewardsQuery();
    const [referreeWalletsResult, transfersResult, volumeResult, totalReferralRewardsResult] = await Promise.all([
      this.depositRepository.query(referreeWalletsQuery, [address]),
      this.depositRepository.query(referralTransfersQuery, [address]),
      this.depositRepository.query(referralVolumeQuery, [address]),
      this.depositRepository.manager.query(totalReferralRewardsQuery, [address]),
    ]);

    const rewardsAmount = new BigNumber(totalReferralRewardsResult[0].acxRewards || 0);
    const transfers = parseInt(transfersResult[0].count);
    const referreeWallets = parseInt(referreeWalletsResult[0].count);
    const volume = volumeResult[0].volume || 0;
    const { referralRate, tier } = this.getTierLevelAndBonus(transfers, volume);

    return {
      referreeWallets,
      transfers,
      volume,
      referralRate,
      rewardsAmount,
      tier,
    };
  }

  public async getReferrals(address: string, limit = 10, offset = 0) {
    const query = getReferralsQuery();
    const result = await this.depositRepository.manager.query(query, [address, limit, offset]);

    return {
      referrals: result.map((item) => ({ ...item, acxRewards: new BigNumber(item.acxRewards) })),
      pagination: {
        limit,
        offset,
      },
    };
  }

  private getTierLevelAndBonus(transfersCount: number, transfersVolumeUsd: number) {
    if (transfersCount >= 20 || transfersVolumeUsd >= 500000) {
      return { referralRate: 0.8, tier: 5 };
    }
    if (transfersCount >= 10 || transfersVolumeUsd >= 250000) {
      return { referralRate: 0.7, tier: 4 };
    }
    if (transfersCount >= 5 || transfersVolumeUsd >= 100000) {
      return { referralRate: 0.6, tier: 3 };
    }
    if (transfersCount >= 3 || transfersVolumeUsd >= 50000) {
      return { referralRate: 0.5, tier: 2 };
    }

    return { referralRate: 0.4, tier: 1 };
  }
}
