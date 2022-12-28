import { DynamicModule, Module, Provider } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../configuration/configuration.module";
import { DepositsMv } from "../deposit/model/DepositsMv.entity";
import { Deposit } from "../scraper/model/deposit.entity";
import { ReferralController } from "./entry-points/http/controller";
import { ReferralCronService } from "./services/cron-service";
import { ReferralService } from "./services/service";
import { ModuleOptions, RunMode } from "../../dynamic-module";

@Module({})
export class ReferralModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    const providers: Provider<any>[] = [ReferralService];

    if (moduleOptions.runModes.includes(RunMode.Scraper) || moduleOptions.runModes.includes(RunMode.Test)) {
      providers.push(ReferralCronService);
    }

    return {
      module: ReferralModule,
      controllers: [ReferralController],
      exports: [ReferralService],
      providers,
      imports: [TypeOrmModule.forFeature([Deposit, DepositsMv]), AppConfigModule],
    };
  }
}
