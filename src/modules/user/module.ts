import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./entry-points/http/user.controller";
import { User } from "./model/user.entity";
import { UserWallet } from "./model/user-wallet.entity";
import { UserService } from "./services/user.service";
import { UserWalletService } from "./services/user-wallet.service";
import { UserFixture } from "./adapter/db/user-fixture";
import { UserWalletFixture } from "./adapter/db/user-wallet-fixture";

@Module({
  providers: [UserService, UserWalletService, UserFixture, UserWalletFixture],
  controllers: [UserController],
  imports: [TypeOrmModule.forFeature([User, UserWallet])],
  exports: [UserService, UserWalletService],
})
export class UserModule {}
