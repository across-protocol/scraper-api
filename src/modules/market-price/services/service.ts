import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DateTime } from "luxon";
import { Repository } from "typeorm";
import { CoinGeckoService, symbolIdMap } from "../adapters/coingecko";
import { HistoricMarketPrice } from "../model/historic-market-price.entity";

@Injectable()
export class MarketPriceService {
  constructor(
    @InjectRepository(HistoricMarketPrice) private historicMarketPriceRepository: Repository<HistoricMarketPrice>,
    private coinGeckoService: CoinGeckoService,
  ) {}

  /**
   * Check if the token is supported by the CoinGecko API
   */
  public isTokenSupportedByPricingApi(symbol: string): boolean {
    return !!symbolIdMap[symbol.toLowerCase()];
  }

  public async getCachedHistoricMarketPrice(date: Date, symbol: string) {
    const formattedDate = DateTime.fromJSDate(date).toFormat("dd-LL-yyyy");
    const dbFormattedDate = DateTime.fromJSDate(date).toFormat("yyyy-LL-dd");
    let price = await this.historicMarketPriceRepository.findOne({ where: { date: dbFormattedDate, symbol } });

    if (!price) {
      const acxLaunchDate = DateTime.fromISO("2022-11-28");
      const isBeforeAcxLaunchDate = DateTime.fromJSDate(date).startOf("day") < acxLaunchDate.startOf("day");

      if (symbol === "acx" && isBeforeAcxLaunchDate) {
        price = await this.getHardcodedAcxHistoricMarketPrice(symbol, dbFormattedDate);
      } else {
        price = await this.getTokenHistoricMarketPrice(symbol, formattedDate, dbFormattedDate);
      }
    }

    return price;
  }

  private async getHardcodedAcxHistoricMarketPrice(symbol: string, dbFormattedDate: string) {
    const price = this.historicMarketPriceRepository.create({
      symbol,
      usd: "0.1",
      date: dbFormattedDate,
    });
    return this.historicMarketPriceRepository.save(price);
  }

  private async getTokenHistoricMarketPrice(symbol: string, formattedDate: string, dbFormattedDate: string) {
    const cgPrice = await this.coinGeckoService.getHistoricPrice(formattedDate, symbol);
    const usd = cgPrice?.market_data?.current_price?.usd;

    if (!usd) return undefined;

    const price = this.historicMarketPriceRepository.create({
      symbol,
      usd: usd.toString(),
      date: dbFormattedDate,
    });
    return this.historicMarketPriceRepository.save(price);
  }
}
