import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HistoricMarketPrice } from "../model/historic-market-price.entity";

@Injectable()
export class HistoricMarketPriceFixture {
  public constructor(@InjectRepository(HistoricMarketPrice) private priceRepository: Repository<HistoricMarketPrice>) {}

  public insertPrice(args: Partial<HistoricMarketPrice>) {
    const price = this.priceRepository.create(this.mockPriceEntity(args));
    return this.priceRepository.save(price);
  }

  public insertManyPrices(args: Partial<HistoricMarketPrice>[]) {
    const createdPrices = this.priceRepository.create(args);
    return this.priceRepository.save(createdPrices);
  }

  public deleteAllPrices() {
    return this.priceRepository.query(`truncate table "historic_market_price" restart identity cascade`);
  }

  public mockPriceEntity(overrides: Partial<HistoricMarketPrice>): Partial<HistoricMarketPrice> {
    return {
      symbol: "TOK",
      date: new Date().toISOString(),
      usd: "1",
      ...overrides,
    };
  }
}
