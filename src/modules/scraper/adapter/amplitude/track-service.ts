import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { init, Types } from "@amplitude/analytics-node";

import { EventOptions, TransferTransactionConfirmedProperties, ampli } from "../../../ampli";
import { AppConfig } from "../../../configuration/configuration.service";

@Injectable()
export class TrackService {
  constructor(private appConfig: AppConfig, private httpService: HttpService) {
    init(appConfig.values.amplitude.apiKey, {
      logLevel: Types.LogLevel.None,
    });
  }

  public async trackDepositFilledEvent(
    userId: string,
    eventProperties: TransferTransactionConfirmedProperties,
    eventOptions?: EventOptions,
  ) {
    return ampli.transferTransactionConfirmed(userId, eventProperties, eventOptions);
  }
}
