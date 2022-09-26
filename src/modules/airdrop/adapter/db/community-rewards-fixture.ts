import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CommunityRewards } from "../../model/community-rewards.entity";

@Injectable()
export class CommunityRewardsFixture {
  public constructor(
    @InjectRepository(CommunityRewards) private communityRewardsRepository: Repository<CommunityRewards>,
  ) {}

  public insertCommunityRewards(args: Partial<CommunityRewards> = {}) {
    const communityRewards = this.communityRewardsRepository.create(this.mockCommunityRewardsEntity(args));
    return this.communityRewardsRepository.save(communityRewards);
  }

  public insertManyCommunityRewards(args: Partial<CommunityRewards>[] = [{}]) {
    const rewards = this.communityRewardsRepository.create(args.map((arg) => this.mockCommunityRewardsEntity(arg)));
    return this.communityRewardsRepository.save(rewards);
  }

  public mockCommunityRewardsEntity(overrides: Partial<CommunityRewards> = {}): Partial<CommunityRewards> {
    return {
      discordId: "discordId",
      amount: "100",
      processed: true,
      ...overrides,
    };
  }

  public deleteAllCommunityRewards() {
    return this.communityRewardsRepository.query(`truncate table "community_rewards" restart identity cascade`);
  }
}
