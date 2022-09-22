import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserController } from "./entry-points/http/user.controller";
import { User } from "./model/user.entity";
import { Wallet } from "./model/wallet.entity";
import { UserService } from "./services/user.service";
import { WalletService } from "./services/wallet.service";

@Module({
  providers: [UserService, WalletService],
  controllers: [UserController],
  imports: [TypeOrmModule.forFeature([User, Wallet])],
  exports: [UserService, WalletService],
})
export class UserModule {}
