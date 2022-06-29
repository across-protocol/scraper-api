import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Deposit } from "../../scraper/model/deposit.entity";

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
              d.status = 'filled'
      ) t`,
      [address],
    );
    const referreeWallets = parseInt(referreeWalletsResult[0].count);
    const transfersCount = await this.depositRepository.count({
      where: {
        referralAddress: address,
        depositDate: Not(IsNull()),
        tokenId: Not(IsNull()),
        status: "filled",
      },
    });

    return {
      referreeWallets,
      transfersCount,
      transfersVolumeUsd: 0,
      tierBonusPct: 0,
      rewardsTokenAmount: 0,
      tier: 0,
    };
  }
}
