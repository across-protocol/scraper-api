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
  ) { }

  // run cron every 5 minutes
  @EnhancedCron("0 1-59/5 * * * *")
  async refreshMaterializedViewCron() {
    if (this.appConfig.values.enableReferralsMaterializedViewRefresh) {
      try {
        await this.depositRepository.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY deposits_mv;`);
      } catch (error) {
        this.logger.error(error);
      }
    } else {
      this.logger.log(`cron disabled`);
    }
  }

  // run cron every 5 minutes, starting with minute 0 to make sure it runs before `refreshMaterializedViewCron`
  @EnhancedCron("0 0-59/5 * * * *")
  async updateStickyReferralAddressesCron() {
    try {
      await this.depositRepository.query(updateStickyReferralAddresses());
    } catch (error) {
      this.logger.error(error);
    }
  }
}
