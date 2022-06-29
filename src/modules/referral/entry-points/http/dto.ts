import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class GetReferralsSummaryQuery {
  @IsString()
  @Length(42, 42)
  @ApiProperty({ example: "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D", minLength: 42, maxLength: 42, required: true })
  address: string;
}
