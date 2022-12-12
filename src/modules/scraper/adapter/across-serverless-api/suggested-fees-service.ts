import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";

import { AppConfig } from "../../../configuration/configuration.service";

type SuggestedFeesApiParams = {
  amount: string;
  token: string;
  destinationChainId: number;
  originChainId: number;
};

type SuggestedFeesApiResponse = {
  data: {
    capitalFeePct: string;
    capitalFeeTotal: string;
    relayGasFeePct: string;
    relayGasFeeTotal: string;
    relayFeePct: string;
    relayFeeTotal: string;
    lpFeePct: string;
    timestamp: string;
    isAmountTooLow: boolean;
  };
};

@Injectable()
export class SuggestedFeesService {
  constructor(private appConfig: AppConfig, private httpService: HttpService) {}

  public async getFromApi(params: SuggestedFeesApiParams) {
    const response = await this.httpService.axiosRef.get<SuggestedFeesApiParams, SuggestedFeesApiResponse>(
      this.appConfig.values.suggestedFees.apiUrl,
      { params },
    );
    return response?.data;
  }
}
