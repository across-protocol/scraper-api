import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsString } from "class-validator";

export class UsersWalletsBody {
  @IsString()
  @ApiProperty()
  signature: string;

  @IsEthereumAddress()
  @ApiProperty()
  walletAddress: string;

  @IsString()
  @ApiProperty()
  discordId: string;
}
