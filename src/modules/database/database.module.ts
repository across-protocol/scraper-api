import { Module } from "@nestjs/common";
import { AppConfigModule } from "../configuration/configuration.module";
import { TypeOrmDefaultConfigService } from "./database.providers";

@Module({
  imports: [AppConfigModule],
  providers: [TypeOrmDefaultConfigService],
  exports: [TypeOrmDefaultConfigService],
})
export class DatabaseModule {}
