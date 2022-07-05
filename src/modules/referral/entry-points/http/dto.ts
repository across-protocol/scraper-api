import { ApiProperty } from "@nestjs/swagger";
import { IsNumberString, IsString, Length } from "class-validator";

export class GetReferralsSummaryQuery {
  @IsString()
  @Length(42, 42)
  @ApiProperty({ example: "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D", minLength: 42, maxLength: 42, required: true })
  address: string;
}

export class GetReferralsQuery {
  @IsString()
  @Length(42, 42)
  @ApiProperty({ example: "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D", minLength: 42, maxLength: 42, required: true })
  address: string;

  @IsNumberString()
  @ApiProperty({ example: "10", required: false })
  limit: string;

  @IsNumberString()
  @ApiProperty({ example: "0", required: false })
  offset: string;
}
