import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UserModule } from "../user/module";
import { AuthController } from "./entry-points/http/auth.controller";
import { DiscordStrategy } from "./entry-points/http/discord.strategy";
import { AuthService } from "./services/auth.service";
import { configValues } from "../configuration";
import { AppConfigModule } from "../configuration/configuration.module";

@Module({
  providers: [DiscordStrategy, AuthService],
  controllers: [AuthController],
  imports: [
    PassportModule.register({}),
    HttpModule,
    UserModule,
    JwtModule.register({
      secret: configValues.auth.jwtSecret,
      signOptions: { expiresIn: "7d" },
    }),
    AppConfigModule,
  ],
  exports: [],
})
export class AuthModule {}
