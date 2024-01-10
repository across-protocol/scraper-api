import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumberString, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class GetReferralsSummaryQuery {
  @IsString()
  @Length(42, 42)
  @ApiProperty({ example: "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D", minLength: 42, maxLength: 42, required: true })
  address: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  fields?: string[];
}

export class GetReferralsQuery {
  @IsString()
  @Length(42, 42)
  @ApiProperty({ example: "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D", minLength: 42, maxLength: 42, required: true })
  address: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @ApiProperty({ example: 10, required: true })
  limit: string;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  @Type(() => Number)
  @ApiProperty({ example: 0, required: true })
  offset: string;
}

export class DeleteReferralsMerkleDistributionBody {
  @IsInt()
  @ApiProperty({ example: 0, required: true })
  windowIndex: number;
}
