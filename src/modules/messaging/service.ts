import { BullModuleOptions, SharedBullConfigurationFactory } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { AppConfig } from "../configuration/configuration.service";

@Injectable()
export class BullConfigService implements SharedBullConfigurationFactory {
  public constructor(private readonly config: AppConfig) {}

  createSharedConfiguration(): BullModuleOptions {
    const { host, password, port } = this.config.values.redis;

    return {
      redis: {
        host,
        port,
        password,
      },
      defaultJobOptions: {
        backoff: { type: "capped" },
        attempts: Number.MAX_SAFE_INTEGER,
      },
      settings: {
        backoffStrategies: {
          capped: (attemptsMade) => {
            return (attemptsMade <= 6 ? 2 ** attemptsMade : 60) * 1000;
          },
        },
      },
    };
  }
}
