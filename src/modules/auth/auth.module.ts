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
import { ModuleOptions, RunMode } from "../../dynamic-module";

@Module({})
export class AuthModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: AuthModule, controllers: [], imports: [], exports: [], providers: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal) || moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        providers: [...module.providers, JwtStrategy, DiscordStrategy, AuthService, DiscordApiService],
        controllers: [...module.controllers, AuthController],
        imports: [
          ...module.imports,
          PassportModule.register({}),
          HttpModule,
          UserModule.forRoot(moduleOptions),
          JwtModule.register({
            secret: configValues().auth.jwtSecret,
            signOptions: { expiresIn: "31d" },
          }),
          AppConfigModule,
        ],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Scraper)) {
      module = {
        ...module,
        providers: [...module.providers, JwtStrategy],
        imports: [...module.imports, PassportModule.register({})],
      };
    }

    return module;
  }
}
