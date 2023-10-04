import { Injectable, Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { AppConfig } from "../../configuration/configuration.service";
import { Deposit } from "../../deposit/model/deposit.entity";
import { EnhancedCron } from "../../../utils";
import { updateStickyReferralAddressesQuery } from "../services/queries";
import { StickyReferralAddressesMechanism } from "../../configuration";
import { ReferralService } from "./service";

@Injectable()
export class ReferralCronService {
  private logger = new Logger(ReferralCronService.name);
  private semaphore = false;

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private appConfig: AppConfig,
    private referralService: ReferralService,
  ) {}

  @EnhancedCron("0 */30 * * * *")
  async startCrons() {
    try {
      if (this.semaphore) return;
      this.semaphore = true;
      await this.updateStickyReferralAddresses();
      await this.refreshMaterializedView();
      this.semaphore = false;
    } catch (error) {
      this.semaphore = false;
      this.logger.error(error);
    }
  }

  private async refreshMaterializedView() {
    this.logger.log("start refreshMaterializedView()");
    if (!this.appConfig.values.enableReferralsMaterializedViewRefresh) {
      this.logger.log(`disabled refreshMaterializedView()`);
    } else {
      try {
        await this.referralService.cumputeReferralStats();
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
      this.logger.log(`skip updateStickyReferralAddresses() cron`);
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
