import { Injectable, Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { AppConfig } from "../../configuration/configuration.service";
import { Deposit } from "../../scraper/model/deposit.entity";
import { EnhancedCron, wait } from "../../../utils";
import { updateStickyReferralAddressesQuery } from "../services/queries";
import { StickyReferralAddressesMechanism } from "src/modules/configuration";

@Injectable()
export class ReferralCronService {
  private logger = new Logger(ReferralCronService.name);
  private semaphore = false;

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private appConfig: AppConfig,
  ) {}

  @EnhancedCron("0 */10 * * * *")
  async startCrons() {
    if (this.semaphore === true) {
      return;
    }
    this.semaphore = true;

    await this.updateStickyReferralAddresses();
    // cooldown period
    await wait(30);
    await this.refreshMaterializedView();

    this.semaphore = false;
  }

  private async refreshMaterializedView() {
    this.logger.log("start refreshMaterializedView()");
    if (!this.appConfig.values.enableReferralsMaterializedViewRefresh) {
      this.logger.log(`disabled refreshMaterializedView()`);
    } else {
      try {
        await this.depositRepository.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY deposits_mv;`);
      } catch (error) {
        this.logger.error(error);
      }
    }

    this.logger.log("end refreshMaterializedView()");
  }

  private async updateStickyReferralAddresses() {
    this.logger.log("start updateStickyReferralAddresses()");

    // sticky referral addresses are updated either by this cron or by the DepositReferralConsumer
    if (this.appConfig.values.stickyReferralAddressesMechanism !== StickyReferralAddressesMechanism.Cron) {
      this.logger.log(`disabled updateStickyReferralAddresses()`);
    } else {
      try {
        await this.depositRepository.query(updateStickyReferralAddressesQuery());
      } catch (error) {
        this.logger.error(error);
      }
    }

    this.logger.log("end updateStickyReferralAddresses()");
  }
}
