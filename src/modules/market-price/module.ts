import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Deposit } from "../scraper/model/deposit.entity";
import { CoinGeckoService } from "./adapters/coingecko";
import { HistoricMarketPrice } from "./model/historic-market-price.entity";
import { MarketPriceCronService } from "./services/cron";
import { MarketPriceService } from "./services/service";

@Module({
  providers: [MarketPriceService, MarketPriceCronService, CoinGeckoService],
  exports: [MarketPriceService],
  imports: [HttpModule, TypeOrmModule.forFeature([HistoricMarketPrice, Deposit])],
})
export class MarketPriceModule {}
