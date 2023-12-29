import { Module, DynamicModule } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";

import { ModuleOptions, RunMode } from "../../dynamic-module";
import { AppConfigModule } from "../configuration/configuration.module";
import { SlackService } from "./adapter/slack/service";
import { MonitoringService } from "./service";
import { SlackReportingCron } from "./service/slack-reporting-cron";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QueueJobCount } from "./model/QueueJobCount.entity";

@Module({})
export class MonitoringModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    const { runModes } = moduleOptions;
    let module: DynamicModule = {
      module: MonitoringModule,
      controllers: [],
      imports: [],
      exports: [],
      providers: [],
    };

    if (runModes.includes(RunMode.Normal)) {
    }

    if (runModes.includes(RunMode.Test)) {
    }

    if (runModes.includes(RunMode.Scraper)) {
      module = {
        ...module,
        providers: [...module.providers, SlackService, MonitoringService, SlackReportingCron],
        imports: [...module.imports, HttpModule, AppConfigModule, TypeOrmModule.forFeature([QueueJobCount])],
        exports: [],
      };
    }

    return module;
  }
}
