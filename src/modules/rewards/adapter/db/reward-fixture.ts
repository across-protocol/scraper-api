import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Reward, RewardMetadata, RewardType } from "../../model/reward.entity";
import { getRandomInt } from "../../../../utils";

@Injectable()
export class RewardFixture {
  public constructor(@InjectRepository(Reward) private rewardRepository: Repository<Reward>) {}

  public insertReward(rewardArgs: Partial<Reward>) {
    const reward = this.rewardRepository.create(mockRewardEntity(rewardArgs));
    return this.rewardRepository.save(reward);
  }

  public deleteAllRewards() {
    return this.rewardRepository.query(`truncate table "reward" restart identity cascade`);
  }
}

export function mockRewardEntity(overrides: Partial<Reward>) {
  return {
    depositPrimaryKey: getRandomInt(),
    recipient: "0x",
    type: "op-rebates" as RewardType,
    metadata: { type: "op-rebates", rate: 0.95 } as RewardMetadata,
    amount: "1000000000000000000",
    amountUsd: "1",
    rewardTokenId: 1,
    rewardTokenPriceId: 1,
    ...overrides,
  };
}
