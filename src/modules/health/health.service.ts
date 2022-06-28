import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class HealthService {
  exec() {
    Logger.log("[HealthService::exec] Health service execution");
  }
}
