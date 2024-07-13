import { HttpModule } from "@nestjs/axios";
import { DynamicModule, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Deposit } from "../deposit/model/deposit.entity";
import { CoinGeckoService } from "./adapters/coingecko";
import { HistoricMarketPriceFixture } from "./adapters/hmp-fixture";
import { HistoricMarketPrice } from "./model/historic-market-price.entity";
import { MarketPriceService } from "./services/service";

@Module({})
export class MarketPriceModule {
  static forRoot(): DynamicModule {
    const module: DynamicModule = {
      module: MarketPriceModule,
      exports: [MarketPriceService],
      providers: [MarketPriceService, CoinGeckoService, HistoricMarketPriceFixture],
      imports: [HttpModule, TypeOrmModule.forFeature([HistoricMarketPrice, Deposit])],
    };

    return module;
  }
}
