import { DynamicModule, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModuleOptions, RunMode } from "src/dynamic-module";
import { AppConfigModule } from "../configuration/configuration.module";
import { Deposit } from "./model/deposit.entity";
import { DepositController } from "./controller";
import { DepositService } from "./service";

@Module({
  controllers: [DepositController],
  exports: [DepositService],
  providers: [DepositService],
  imports: [TypeOrmModule.forFeature([Deposit]), AppConfigModule],
})
export class DepositModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: DepositModule, providers: [], controllers: [], imports: [], exports: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal)) {
      module = {
        ...module,
        controllers: [...module.controllers, DepositController],
        providers: [...module.providers, DepositService],
        imports: [...module.imports, TypeOrmModule.forFeature([Deposit]), AppConfigModule],
      };
    }

    return module;
  }
}
