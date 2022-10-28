import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumberString, IsOptional } from "class-validator";

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
  status: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @ApiProperty({ example: "10", required: false })
  limit: string;

  @IsOptional()
  @IsNumberString({ no_symbols: true })
  @ApiProperty({ example: "0", required: false })
  offset: string;
}

export class GetDepositsStatsResponse {
  @ApiProperty({ example: 100, description: "Total number of deposits" })
  totalDeposits: number;

  @ApiProperty({ description: "The average fill time of deposits in seconds", example: 200 })
  avgFillTime: number;

  @ApiProperty({ description: "The total bridged volume in USD", example: 1_000_000 })
  totalVolumeUsd: number;
}
