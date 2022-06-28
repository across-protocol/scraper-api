import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import configuration from "./modules/configuration";
import { DatabaseModule } from "./modules/database/database.module";
import { TypeOrmDefaultConfigService } from "./modules/database/database.providers";
import { HealthModule } from "./modules/health/health.module";
import { MessagingModule } from "./modules/messaging/module";
import { BullConfigService } from "./modules/messaging/service";
import { ScraperModule } from "./modules/scraper/module";
import { Web3Module } from "./modules/web3/module";

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: false,
      ignoreEnvVars: false,
      isGlobal: true,
      expandVariables: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [DatabaseModule],
      useExisting: TypeOrmDefaultConfigService,
    }),
    HealthModule,
    Web3Module,
    ScraperModule,
    BullModule.forRootAsync({
      imports: [MessagingModule],
      useExisting: BullConfigService,
    }),
  ],
})
export class AppModule {}
