import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit } from "src/modules/scraper/model/deposit.entity";
import { Repository } from "typeorm";

@Injectable()
export class ReferralCronService {
  private logger = new Logger(ReferralCronService.name);

  constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {}

  // run cron every 3 minutes
  @Cron("0 */3 * * * *")
  async handleCron() {
    try {
      await this.depositRepository.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY deposits_mv;`);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
