import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Deposit } from "../deposit/model/deposit.entity";
import { CoinGeckoService } from "./adapters/coingecko";
import { HistoricMarketPriceFixture } from "./adapters/hmp-fixture";
import { HistoricMarketPrice } from "./model/historic-market-price.entity";
import { MarketPriceService } from "./services/service";

@Module({
  providers: [MarketPriceService, CoinGeckoService, HistoricMarketPriceFixture],
  exports: [MarketPriceService],
  imports: [HttpModule, TypeOrmModule.forFeature([HistoricMarketPrice, Deposit])],
})
export class MarketPriceModule {}
