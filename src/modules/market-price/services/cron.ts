import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { DateTime } from "luxon";
import { Deposit } from "src/modules/scraper/model/deposit.entity";
import { Repository } from "typeorm";

@Injectable()
export class MarketPriceCronService {
  constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {

  }
  // @Cron(CronExpression.EVERY_10_SECONDS)
  async fetchHistoricPrices() {
    const date = DateTime.now().minus({ days: 1 }).toFormat("yyyy-LL-dd");
    console.log({ date });
    const deposits = await this.depositRepository
      .createQueryBuilder()
      .where(`cast(depositDate as date) = :date`, { date })
      .andWhere("priceUsd is null")
      .getCount();

    console.log({ deposits });
  }
}
