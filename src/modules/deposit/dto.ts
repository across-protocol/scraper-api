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
  @IsNumberString()
  @ApiProperty({ example: "10", required: false })
  limit: string;

  @IsOptional()
  @IsNumberString()
  @ApiProperty({ example: "0", required: false })
  offset: string;
}
