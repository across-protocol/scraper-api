import { Module } from "@nestjs/common";
import { AppConfig } from "./configuration.service";

@Module({
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
