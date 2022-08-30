import { Injectable, Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { AppConfig } from "../../configuration/configuration.service";
import { Deposit } from "../../scraper/model/deposit.entity";
import { EnhancedCron } from "../../../utils";
import { updateStickyReferralAddresses } from "../services/queries";

@Injectable()
export class ReferralCronService {
  private logger = new Logger(ReferralCronService.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private appConfig: AppConfig,
  ) {}

  // run cron every 8 minutes
  @EnhancedCron("0 4-59/8 * * * *")
  async refreshMaterializedViewCron() {
    this.logger.log("start refreshMaterializedViewCron()");
    if (this.appConfig.values.enableReferralsMaterializedViewRefresh) {
      try {
        await this.depositRepository.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY deposits_mv;`);
      } catch (error) {
        this.logger.error(error);
      }
    } else {
      this.logger.log(`cron disabled`);
    }
    this.logger.log("end refreshMaterializedViewCron()");
  }

  // run cron every 8 minutes, starting with minute 0 to make sure it runs before `refreshMaterializedViewCron`
  @EnhancedCron("0 0-59/8 * * * *")
  async updateStickyReferralAddressesCron() {
    this.logger.log("start updateStickyReferralAddressesCron()");
    try {
      await this.depositRepository.query(updateStickyReferralAddresses());
    } catch (error) {
      this.logger.error(error);
    }
    this.logger.log("end updateStickyReferralAddressesCron()");
  }
}
