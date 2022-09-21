import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtStrategy } from "../auth/entry-points/http/jwt.strategy";
import { UserController } from "./entry-points/http/user.controller";
import { User } from "./model/user.entity";
import { UserService } from "./services/user.service";

@Module({
  providers: [JwtStrategy, UserService],
  controllers: [UserController],
  imports: [TypeOrmModule.forFeature([User])],
  exports: [UserService],
})
export class UserModule {}
