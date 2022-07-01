import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Deposit } from "../../scraper/model/deposit.entity";
import BigNumber from "bignumber.js";
import { getReferralsQuery } from "./queries";
@Injectable()
export class ReferralService {
  constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {}

  public async getReferralSummary(address: string) {
    const referreeWalletsResult = await this.depositRepository.query(
      `select count(*) from (
        select distinct on (d."depositorAddr") d."depositorAddr"
        from deposit d
        where d."referralAddress" = $1 and
              d."depositDate" is not null and
              d."tokenId" is not null and
              d."priceId" is not null and
              d.status = 'filled'
      ) t`,
      [address],
    );
    const referreeWallets = parseInt(referreeWalletsResult[0].count);
    const transfers = await this.depositRepository.count({
      where: {
        referralAddress: address,
        depositDate: Not(IsNull()),
        tokenId: Not(IsNull()),
        priceId: Not(IsNull()),
        status: "filled",
      },
    });
    const volumeData = await this.depositRepository.manager.query(
      `
      select sum(d.amount / power(10, t.decimals) * hmp.usd) as volume
      from deposit d
        join token t on d."tokenId" = t.id
        join historic_market_price hmp on d."priceId" = hmp.id
      where d."referralAddress" = $1
        and d."depositDate" is not null
        and d."tokenId" is not null
        and d."priceId" is not null
        and d.status = 'filled'`,
      [address],
    );

    const volume = volumeData[0].volume || 0;
    const { referralRate, tier } = this.getTierLevelAndBonus(transfers, volume);

    return {
      referreeWallets,
      transfers,
      volume,
      referralRate,
      rewardsAmount: "TODO",
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
