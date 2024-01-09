import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min, IsString, IsArray, IsEnum, IsDateString, IsNumberString } from "class-validator";
import { RewardsType } from "../../model/RewardsWindowJob.entity";

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

export class CreateRewardsWindowJobBody {
  @IsDateString()
  @ApiProperty({ example: "2022-11-08T11:00:00.000Z", required: true })
  maxDepositDate: string;

  @IsInt()
  @ApiProperty({ example: 0, required: true })
  windowIndex: number;

  @IsEnum(RewardsType)
  @ApiProperty({ example: "referrals", required: true, enum: RewardsType })
  rewardsType: RewardsType;
}

export class GetRewardsWindowJobParams {
  @IsNumberString()
  id: number;
}
