import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { AppConfig } from "../configuration/configuration.service";
import { ProcessedBlock } from "../scraper/model/ProcessedBlock.entity";
import { Block } from "../web3/model/block.entity";
import { Deposit } from "../scraper/model/deposit.entity";
import { Token } from "../web3/model/token.entity";
import { Transaction } from "../web3/model/transaction.entity";
import { HistoricMarketPrice } from "../market-price/model/historic-market-price.entity";
import { User } from "../user/model/user.entity";
import { Wallet } from "../user/model/wallet.entity";

// TODO: Add db entities here
const entities = [ProcessedBlock, Block, Deposit, Token, Transaction, HistoricMarketPrice, User, Wallet];

@Injectable()
export class TypeOrmDefaultConfigService implements TypeOrmOptionsFactory {
  constructor(protected readonly config: AppConfig) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "postgres",
      synchronize: false,
      autoLoadEntities: false,
      logging: false,
      entities,
      ...this.config.values.database,
    };
  }
}
