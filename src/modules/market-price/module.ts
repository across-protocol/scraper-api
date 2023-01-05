import { HttpModule } from "@nestjs/axios";
import { DynamicModule, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ModuleOptions, RunMode } from "../../dynamic-module";
import { Deposit } from "../deposit/model/deposit.entity";
import { CoinGeckoService } from "./adapters/coingecko";
import { HistoricMarketPriceFixture } from "./adapters/hmp-fixture";
import { HistoricMarketPrice } from "./model/historic-market-price.entity";
import { MarketPriceService } from "./services/service";

@Module({})
export class MarketPriceModule {
  static forRoot(moduleOptions: ModuleOptions): DynamicModule {
    let module: DynamicModule = { module: MarketPriceModule, providers: [], controllers: [], imports: [], exports: [] };

    if (moduleOptions.runModes.includes(RunMode.Normal) || moduleOptions.runModes.includes(RunMode.Scraper)) {
      module = {
        ...module,
        exports: [...module.exports, MarketPriceService],
        providers: [...module.providers, MarketPriceService, CoinGeckoService],
        imports: [...module.imports, HttpModule, TypeOrmModule.forFeature([HistoricMarketPrice, Deposit])],
      };
    }

    if (moduleOptions.runModes.includes(RunMode.Test)) {
      module = {
        ...module,
        providers: [...module.providers, HistoricMarketPriceFixture],
      };
    }

    return module;
  }
}
