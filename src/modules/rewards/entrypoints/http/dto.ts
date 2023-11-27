import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min, IsString, IsArray, IsEnum } from "class-validator";

export class GetSummaryQuery {
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: "0x", required: true })
  userAddress: string;
}

export class GetReferralRewardsSummaryQuery extends GetSummaryQuery {
  @IsOptional()
  @IsArray()
  @IsEnum(
    {
      REFERRAL_RATE: "referralRate",
    },
    { each: true, message: "Must be one of: 'referralRate'" },
  )
  @ApiProperty({ example: ["referralRate"], required: false })
  fields: Array<"referralRate">;
}

export class GetRewardsQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @ApiProperty({ example: 10, required: false })
  limit: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  @Type(() => Number)
  @ApiProperty({ example: 0, required: false })
  offset: string;

  @IsString()
  @Type(() => String)
  @ApiProperty({ example: "0x", required: true })
  userAddress: string;
}
