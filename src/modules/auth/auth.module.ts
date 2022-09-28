import { HttpModule } from "@nestjs/axios";
import { Module, DynamicModule } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UserModule } from "../user/module";
import { AuthController } from "./entry-points/http/auth.controller";
import { DiscordStrategy } from "./entry-points/http/discord.strategy";
import { AuthService } from "./services/auth.service";
import { configValues } from "../configuration";
import { AppConfigModule } from "../configuration/configuration.module";
import { JwtStrategy } from "./entry-points/http/jwt.strategy";
import { DiscordApiService } from "./adapters/discord";
import { ModuleOptions } from "../../dynamic-module";

@Module({})
export class AuthModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      providers: [JwtStrategy, DiscordStrategy, AuthService, DiscordApiService],
      controllers: [AuthController],
      imports: [
        PassportModule.register({}),
        HttpModule,
        UserModule.forRoot(moduleOptions),
        JwtModule.register({
          secret: configValues().auth.jwtSecret,
          signOptions: { expiresIn: "31d" },
        }),
        AppConfigModule,
      ],
      exports: [],
    };
  }
}
