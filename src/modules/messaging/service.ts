import { BullModuleOptions, SharedBullConfigurationFactory } from "@nestjs/bull";
import { Injectable } from "@nestjs/common";
import { AppConfig } from "../configuration/configuration.service";

@Injectable()
export class BullConfigService implements SharedBullConfigurationFactory {
  public constructor(private readonly config: AppConfig) {}

  createSharedConfiguration(): BullModuleOptions {
    const { host, password, port } = this.config.values.redis;

    const isDefaultHost = ["localhost", "127.0.0.1", "redis"].includes(host);

    return {
      redis: {
        host,
        port,
        // Suppresses noisy warn log message. Related https://github.com/luin/ioredis/issues/1249
        password: isDefaultHost ? undefined : password,
      },
      defaultJobOptions: {
        backoff: { type: "capped" },
        attempts: Number.MAX_SAFE_INTEGER,
        removeOnComplete: true,
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
