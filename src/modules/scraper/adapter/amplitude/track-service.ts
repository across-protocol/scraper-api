import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";

import { EventOptions, TransferFillCompletedProperties, ampli } from "../../../ampli";
import { AppConfig } from "../../../configuration/configuration.service";

@Injectable()
export class TrackService {
  constructor(private appConfig: AppConfig, private httpService: HttpService) {
    if (appConfig.values.amplitude.apiKey) {
      ampli.load({
        client: {
          apiKey: appConfig.values.amplitude.apiKey,
        },
      });
    }
  }

  public isEnabled() {
    return Boolean(this.appConfig.values.amplitude.apiKey);
  }

  public async trackDepositFilledEvent(
    userId: string,
    eventProperties: TransferFillCompletedProperties,
    eventOptions?: EventOptions,
  ) {
    return ampli.transferFillCompleted(userId, eventProperties, eventOptions);
  }
}
