import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class HealthDto {
  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    example: true,
    description: "Set true for db health data",
    required: false,
  })
  db: boolean;

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    example: true,
    description: "Set true for instance health data",
  })
  instance: boolean;
}

export enum HealthScope {
  db = "db",
  instance = "instance",
}

export class HealthParamsDto {
  @IsEnum(HealthScope)
  @ApiProperty({
    required: false,
    example: "db",
    enum: ["db", "instance"],
    description: "Specify the scope of health",
  })
  scope: HealthScope;
}
