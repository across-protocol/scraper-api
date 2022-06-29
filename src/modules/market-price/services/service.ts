import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DateTime } from "luxon";
import { Repository } from "typeorm";
import { CoinGeckoService } from "../adapters/coingecko";
import { HistoricMarketPrice } from "../model/historic-market-price.entity";

@Injectable()
export class MarketPriceService {
  constructor(
    @InjectRepository(HistoricMarketPrice) private historicMarketPriceRepository: Repository<HistoricMarketPrice>,
    private coinGeckoService: CoinGeckoService,
  ) { }

  public async getCachedHistoricMarketPrice(date: Date, symbol: string) {
    const formattedDate = DateTime.fromJSDate(date).toFormat("dd-LL-yyyy");
    let price = await this.historicMarketPriceRepository.findOne({ where: { date: formattedDate, symbol } });

    if (!price) {
      const cgPrice = await this.coinGeckoService.getHistoricPrice(formattedDate, symbol);
      const usd = cgPrice?.market_data?.current_price?.usd;

      if (!usd) return undefined;

      price = this.historicMarketPriceRepository.create({
        symbol,
        usd: usd.toString(),
        date: formattedDate,
      });
      price = await this.historicMarketPriceRepository.save(price);
    }

    return price;
  }
}
