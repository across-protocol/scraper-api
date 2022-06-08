import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./modules/configuration";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: false,
      ignoreEnvVars: false,
      isGlobal: true,
      expandVariables: true,
      load: [configuration],
    }),
    HealthModule,
  ],
})
export class AppModule {}
