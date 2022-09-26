import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class GetAirdropRewardsQuery {
  @IsString()
  @Length(42, 42, { message: "Invalid Ethereum address length" })
  @ApiProperty()
  address: string;
}

export class GetAirdropRewardsCategoryResponse {
  @ApiProperty()
  eligible: boolean;

  @ApiProperty({ example: "1000", description: "Rewards amount in wei" })
  amount: string;
}

export class GetAirdropRewardsCategoryWithCompletedResponse {
  @ApiProperty()
  eligible: boolean;

  @ApiProperty({ example: "1000", description: "Rewards amount in wei" })
  amount: string;

  @ApiProperty({ example: false })
  completed: boolean;
}

export class GetAirdropRewardsResponse {
  @ApiProperty()
  welcomeTravellerRewards: GetAirdropRewardsCategoryWithCompletedResponse;

  @ApiProperty()
  earlyUserRewards: GetAirdropRewardsCategoryResponse;

  @ApiProperty()
  liquidityProviderRewards: GetAirdropRewardsCategoryResponse;

  @ApiProperty()
  communityRewards: GetAirdropRewardsCategoryResponse;
}
