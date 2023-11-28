import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsIn, IsInt, IsOptional, IsString } from "class-validator";
import { ScraperQueue } from "../../adapter/messaging";

export class ProcessBlocksBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  chainId: number;

  @IsInt()
  @ApiProperty({ example: 1 })
  from: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  to: number;
}

export class ProcessPricesBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class SubmitReferralAddressJobBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class SubmitReindexReferralAddressJobBody {
  @IsDateString()
  @ApiProperty({ example: "2022-11-08T11:00:00.000Z", required: true })
  fromDate: string;

  @IsDateString()
  @ApiProperty({ example: "2022-11-08T11:00:00.000Z", required: true })
  toDate: string;
}

export class SubmitDepositFilledDateBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class SubmitDepositAcxPriceBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class ProcessBlockNumberBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class SubmitSuggestedFeesBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class SubmitFeeBreakdownBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class OpRebateRewardBody {
  @IsInt()
  @ApiProperty({ example: 1 })
  fromDepositId: number;

  @IsInt()
  @ApiProperty({ example: 2 })
  toDepositId: number;
}

export class RetryFailedJobsBody {
  @IsString()
  @IsIn(Object.values(ScraperQueue))
  @ApiProperty({ enum: ScraperQueue, isArray: false })
  queue: ScraperQueue;

  @IsOptional()
  @IsInt()
  @ApiProperty({ example: 0 })
  count?: number;
}

export class RetryIncompleteDepositsBody {
  @IsOptional()
  @IsInt()
  @ApiProperty({ example: 0 })
  count?: number;
}

export class BackfillFeeBreakdownBody {
  @IsOptional()
  @IsInt()
  @ApiProperty({ example: 0 })
  count?: number;
}
