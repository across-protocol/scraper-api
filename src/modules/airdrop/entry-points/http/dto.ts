import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsEthereumAddress, IsNumberString, IsOptional, IsString, Length } from "class-validator";

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

export const IncludeDiscordQueryValues = ["true", "false"] as const;
export class GetMerkleDistributorProofQuery {
  @IsNumberString()
  windowIndex: number;

  @IsEthereumAddress()
  address: string;

  @IsEnum(IncludeDiscordQueryValues)
  @IsOptional()
  includeDiscord: typeof IncludeDiscordQueryValues[number];
}

export class GetMerkleDistributorProofsQuery {
  @ApiProperty()
  @IsNumberString()
  @IsOptional()
  startWindowIndex: number;

  @ApiProperty()
  @IsEthereumAddress()
  address: string;
}

export class GetEtlMerkleDistributorRecipientsQuery {
  @ApiProperty({ example: "0" })
  @IsNumberString({ no_symbols: true })
  windowIndex: number;
}
