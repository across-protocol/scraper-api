import { Injectable, Inject } from "@nestjs/common";
import { ConfigType, ConfigService } from "@nestjs/config";
import configuration from "./index";

@Injectable()
export class AppConfig {
  constructor(
    @Inject(configuration.KEY)
    protected conf: ConfigType<typeof configuration>,
    public service: ConfigService,
  ) {}

  public get values() {
    return this.conf;
  }
}
