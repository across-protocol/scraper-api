import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { AppConfig } from "../../../configuration/configuration.service";

@Injectable()
export class SlackService {
  constructor(private httpService: HttpService, private appConfig: AppConfig) {}

  public async postMessage(url: string, payload: any): Promise<any> {
    return this.httpService.axiosRef.post(url, payload);
  }
}
