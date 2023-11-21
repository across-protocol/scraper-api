import { BullModule } from "@nestjs/bull";
import { CacheModule, MiddlewareConsumer, Module, DynamicModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LogsMiddleware } from "./logging.interceptor";
import configuration, { configValues } from "./modules/configuration";
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
import { AirdropModule } from "./modules/airdrop/module";
import { RewardModule } from "./modules/rewards/module";
import { ModuleOptions, RunMode } from "./dynamic-module";

@Module({})
export class AppModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    const imports = [
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
      ReferralModule.forRoot(moduleOptions),
      MarketPriceModule.forRoot(moduleOptions),
      ScheduleModule.forRoot(),
      DepositModule.forRoot(moduleOptions),
      AuthModule.forRoot(moduleOptions),
      UserModule.forRoot(moduleOptions),
      AirdropModule.forRoot(moduleOptions),
      RewardModule.forRoot(moduleOptions),
      CacheModule.register({ isGlobal: true }),
    ];

    if (moduleOptions.runModes.includes(RunMode.Scraper)) {
      imports.push(
        ScraperModule.forRoot(moduleOptions),
        BullModule.forRootAsync({
          imports: [MessagingModule],
          useExisting: BullConfigService,
        }),
      );
    }

    return {
      module: AppModule,
      imports,
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LogsMiddleware).forRoutes("*");
  }
}
