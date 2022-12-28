import { Module, Provider, DynamicModule } from "@nestjs/common";
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
    const providers: Provider<any>[] = [UserService, UserWalletService];

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      providers.push(UserFixture, UserWalletFixture);
    }

    return {
      module: UserModule,
      providers,
      controllers: [UserController],
      imports: [TypeOrmModule.forFeature([User, UserWallet])],
      exports: [UserService, UserWalletService],
    };
  }
}
