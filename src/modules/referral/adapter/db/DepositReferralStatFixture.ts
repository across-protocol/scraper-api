import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { getRandomInt } from "../../../../utils";
import { DepositReferralStat } from "../../../deposit/model/deposit-referral-stat.entity";

@Injectable()
export class DepositReferralStatFixture {
  public constructor(
    @InjectRepository(DepositReferralStat) private depositReferralStat: Repository<DepositReferralStat>,
  ) {}

  public insertDepositReferralStat(args: Partial<DepositReferralStat>) {
    const entity = this.depositReferralStat.create(mockDepositReferralStatEntity(args));
    return this.depositReferralStat.save(entity);
  }

  public deleteAllDepositReferralStats() {
    return this.depositReferralStat.query(`truncate table "deposit_referral_stat" restart identity cascade`);
  }
}

export function mockDepositReferralStatEntity(overrides: Partial<DepositReferralStat>) {
  return {
    depositId: getRandomInt(0, 100),
    referralCount: getRandomInt(0, 100),
    referralVolume: "100",
    ...overrides,
  };
}
