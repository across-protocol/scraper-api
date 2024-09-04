import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsPositive,
  IsArray,
  ArrayMaxSize,
  IsNumberString,
} from "class-validator";

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

export class GetDepositStatusQuery {
  @IsNumberString({ no_symbols: true })
  @ApiProperty({ example: 1293630, required: true })
  depositId: string;

  @IsNumberString({ no_symbols: true })
  @ApiProperty({ example: 59144, required: true })
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

export class GetDepositsBaseQuery {
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
  @IsInt()
  @Type(() => Number)
  @ApiProperty({ example: 0, required: false })
  originChainId: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @ApiProperty({ example: 0, required: false })
  destinationChainId: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: "0x", required: false })
  tokenAddress: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: "0x", required: false })
  depositorOrRecipientAddress: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: "0x", required: false })
  depositorAddress: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @ApiProperty({ example: "0x", required: false })
  recipientAddress: string;

  @IsOptional()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({ example: "2022-11-08T11:00:00.000Z", required: false })
  startDepositDate: string;

  @IsOptional()
  @IsDateString()
  @Type(() => String)
  @ApiProperty({ example: "2022-11-08T11:00:00.000Z", required: false })
  endDepositDate: string;

  @IsOptional()
  @IsArray()
  @IsEnum(
    {
      TOKEN: "token",
    },
    { each: true, message: "Must be one of: 'token'" },
  )
  @ArrayMaxSize(1)
  @ApiProperty({ example: ["token"], required: false })
  include: Array<"token">;
}

export class GetDepositsV2Query extends GetDepositsBaseQuery {}

export class GetDepositsForTxPageQuery {
  @IsOptional()
  @IsString()
  @ApiProperty({ example: "0x", required: false })
  depositorOrRecipientAddress?: string;

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
  status?: "filled" | "pending";

  @IsOptional()
  include: any;

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
