import { BullModule } from "@nestjs/bull";
import { MiddlewareConsumer, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LogsMiddleware } from "./logging.interceptor";
import configuration from "./modules/configuration";
import { DatabaseModule } from "./modules/database/database.module";
import { TypeOrmDefaultConfigService } from "./modules/database/database.providers";
import { HealthModule } from "./modules/health/health.module";
import { MarketPriceModule } from "./modules/market-price/module";
import { MessagingModule } from "./modules/messaging/module";
import { BullConfigService } from "./modules/messaging/service";
import { ReferralModule } from "./modules/referral/module";
import { ScraperModule } from "./modules/scraper/module";
import { Web3Module } from "./modules/web3/module";
import { DepositModule } from "./modules/deposit/module";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/module";

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
    ReferralModule,
    MarketPriceModule,
    ScheduleModule.forRoot(),
    DepositModule,
    AuthModule,
    UserModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LogsMiddleware).forRoutes("*");
  }
}
