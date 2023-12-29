import { Module, DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./entry-points/http/user.controller";
import { User } from "./model/user.entity";
import { UserWallet } from "./model/user-wallet.entity";
import { UserService } from "./services/user.service";
import { UserWalletService } from "./services/user-wallet.service";
import { UserFixture } from "./adapter/db/user-fixture";
import { UserWalletFixture } from "./adapter/db/user-wallet-fixture";
import { ModuleOptions, RunMode } from "../../dynamic-module";

@Module({})
export class UserModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: UserModule, providers: [], controllers: [], imports: [], exports: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal) || moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        controllers: [...module.controllers, UserController],
        providers: [...module.providers, UserService, UserWalletService],
        imports: [...module.imports, TypeOrmModule.forFeature([User, UserWallet])],
        exports: [UserService, UserWalletService],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        providers: [...module.providers, UserFixture, UserWalletFixture],
      };
    }

    return module;
  }
}
