import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { init, Types } from "@amplitude/analytics-node";

import { EventOptions, TransferTransactionConfirmedProperties, ampli } from "../../../ampli";
import { AppConfig } from "../../../configuration/configuration.service";

@Injectable()
export class TrackService {
  constructor(private appConfig: AppConfig, private httpService: HttpService) {
    ampli.load({
      client: {
        apiKey: appConfig.values.amplitude.apiKey,
        configuration: {
          logLevel: Types.LogLevel.Debug,
        },
      },
    });
  }

  public isEnabled() {
    return Boolean(this.appConfig.values.amplitude.apiKey);
  }

  public async trackDepositFilledEvent(
    userId: string,
    eventProperties: TransferTransactionConfirmedProperties,
    eventOptions?: EventOptions,
  ) {
    return ampli.transferTransactionConfirmed(userId, eventProperties, eventOptions);
  }
}
