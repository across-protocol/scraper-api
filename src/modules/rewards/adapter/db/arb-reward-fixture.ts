import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ArbReward, RewardMetadata } from "../../model/arb-reward.entity";
import { getRandomInt } from "../../../../utils";

@Injectable()
export class ArbRewardFixture {
  public constructor(@InjectRepository(ArbReward) private arbRewardRepository: Repository<ArbReward>) {}

  public insertArbReward(arbRewardArgs: Partial<ArbReward>) {
    const arbReward = this.arbRewardRepository.create(mockArbRewardEntity(arbRewardArgs));
    return this.arbRewardRepository.save(arbReward);
  }

  public deleteAllArbRewards() {
    return this.arbRewardRepository.query(`truncate table "arb_reward" restart identity cascade`);
  }
}

export function mockArbRewardEntity(overrides: Partial<ArbReward>) {
  return {
    depositPrimaryKey: getRandomInt(),
    recipient: "0x",
    metadata: { rate: 0.95 } as RewardMetadata,
    amount: "1000000000000000000",
    amountUsd: "1",
    rewardTokenId: 1,
    depositDate: new Date(),
    ...overrides,
  };
}
