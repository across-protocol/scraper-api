import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigModule } from "../configuration/configuration.module";
import { TokenFixture } from "./adapters/db/token-fixture";
import { Block } from "./model/block.entity";
import { Token } from "./model/token.entity";
import { Transaction } from "./model/transaction.entity";
import { EthProvidersService } from "./services/EthProvidersService";

@Module({
  providers: [EthProvidersService, TokenFixture],
  exports: [EthProvidersService],
  imports: [AppConfigModule, TypeOrmModule.forFeature([Block, Token, Transaction])],
})
export class Web3Module {}
