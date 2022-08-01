import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { AppConfig } from "src/modules/configuration/configuration.service";
import { Deposit } from "src/modules/scraper/model/deposit.entity";

@Injectable()
export class ReferralCronService {
  private logger = new Logger(ReferralCronService.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private appConfig: AppConfig,
  ) {}

  // run cron every 3 minutes
  @Cron("0 */3 * * * *")
  async handleCron() {
    // if (this.appConfig.values.enableReferralsMaterializedViewRefresh) {
      try {
        await this.depositRepository.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY deposits_mv;`);
      } catch (error) {
        this.logger.error(error);
      }
    // } else {
    //   this.logger.log(`cron disabled`);
    // }
  }
}
