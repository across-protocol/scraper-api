import { Module } from "@nestjs/common";
import { AppConfigModule } from "../configuration/configuration.module";
import { BullConfigService } from "./service";

@Module({
  imports: [AppConfigModule],
  providers: [BullConfigService],
  exports: [BullConfigService],
})
export class MessagingModule {}
