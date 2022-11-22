import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

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

export class SubmitDepositFilledDateBody {
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
