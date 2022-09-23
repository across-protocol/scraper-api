import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./entry-points/http/user.controller";
import { User } from "./model/user.entity";
import { UserWallet } from "./model/user-wallet.entity";
import { UserService } from "./services/user.service";
import { UserWalletService } from "./services/user-wallet.service";

@Module({
  providers: [UserService, UserWalletService],
  controllers: [UserController],
  imports: [TypeOrmModule.forFeature([User, UserWallet])],
  exports: [UserService, UserWalletService],
})
export class UserModule {}
