import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, IsPositive } from "class-validator";

export class GetDepositsQuery {
  @IsOptional()
  @IsEnum(
    {
      FILLED: "filled",
      PENDING: "pending",
    },
    {
      message: "Must be one of: 'filled', 'pending'",
    },
  )
  @ApiProperty({ example: "filled", required: false })
  status: "filled" | "pending";

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

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  address: string;
}

export class GetDepositDetailsQuery {
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: "0x", required: true })
  depositTxHash: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  @ApiProperty({ example: 1, required: true })
  originChainId: string;
}

export class GetDepositsStatsResponse {
  @ApiProperty({ example: 100, description: "Total number of deposits" })
  totalDeposits: number;

  @ApiProperty({ description: "The average fill time of deposits in seconds", example: 200 })
  avgFillTime: number;

  @ApiProperty({ description: "The total bridged volume in USD", example: 1_000_000 })
  totalVolumeUsd: number;
}

export class GetEtlReferralDepositsQuery {
  @IsDateString()
  date: string;
}

export class GetPendingDepositsQuery {
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
}
