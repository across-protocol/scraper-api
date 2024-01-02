import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { OpReward, RewardMetadata } from "../../model/reward.entity";
import { getRandomInt } from "../../../../utils";

@Injectable()
export class RewardFixture {
  public constructor(@InjectRepository(OpReward) private opRewardRepository: Repository<OpReward>) {}

  public insertOpReward(opRewardArgs: Partial<OpReward>) {
    const opReward = this.opRewardRepository.create(mockOpRewardEntity(opRewardArgs));
    return this.opRewardRepository.save(opReward);
  }

  public deleteAllOpRewards() {
    return this.opRewardRepository.query(`truncate table "op_reward" restart identity cascade`);
  }
}

export function mockOpRewardEntity(overrides: Partial<OpReward>) {
  return {
    depositPrimaryKey: getRandomInt(),
    recipient: "0x",
    metadata: { rate: 0.95 } as RewardMetadata,
    amount: "1000000000000000000",
    amountUsd: "1",
    rewardTokenId: 1,
    rewardTokenPriceId: 1,
    depositDate: new Date(),
    ...overrides,
  };
}
