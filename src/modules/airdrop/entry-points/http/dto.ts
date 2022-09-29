import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsNumberString, IsString, Length } from "class-validator";

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

export class EditWalletRewardsBody {
  @ApiProperty({ example: "0x0000000000000000000000000000000000000000" })
  @IsEthereumAddress()
  walletAddress: string;

  @ApiProperty({ example: "0" })
  @IsNumberString({ no_symbols: true })
  earlyUserRewards: string;

  @ApiProperty({ example: "0" })
  @IsNumberString({ no_symbols: true })
  liquidityProviderRewards: string;

  @ApiProperty({ example: "0" })
  @IsNumberString({ no_symbols: true })
  welcomeTravellerRewards: string;
}
