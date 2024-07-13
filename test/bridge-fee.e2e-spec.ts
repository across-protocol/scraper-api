import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import BigNumber from "bignumber.js";

import { AppModule } from "../src/app.module";
import { RunMode } from "../src/dynamic-module";
import { ValidationPipe } from "../src/validation.pipe";
import { HistoricMarketPriceFixture } from "../src/modules/market-price/adapters/hmp-fixture";
import { TokenFixture } from "../src/modules/web3/adapters/db/token-fixture";
import { DepositFixture } from "../src/modules/deposit/adapter/db/deposit-fixture";
import { Deposit } from "../src/modules/deposit/model/deposit.entity";
import { DepositService } from "../src/modules/deposit/service";
import { ChainIds } from "../src/modules/web3/model/ChainId";

let app: INestApplication;
let depositFixture: DepositFixture;
let historicMarketPriceFixture: HistoricMarketPriceFixture;
let tokenFixture: TokenFixture;
let deposit: Deposit;
let depositService: DepositService;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runModes: [RunMode.Normal] })],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  depositFixture = app.get(DepositFixture);
  historicMarketPriceFixture = app.get(HistoricMarketPriceFixture);
  tokenFixture = app.get(TokenFixture);
  depositService = app.get(DepositService);
});

afterAll(async () => {
  await app.close();
});

describe("DepositService::getLastDepositThatPassedGapCheck", () => {
  beforeEach(async () => {
    await depositFixture.deleteAllDeposits();
    await historicMarketPriceFixture.deleteAllPrices();
    await tokenFixture.deleteAllTokens();

    const inputToken = await tokenFixture.insertToken({
      address: "0xDAI",
      chainId: ChainIds.mainnet,
      name: "DAI",
      symbol: "DAI",
      decimals: 18,
    });
    const outputToken = await tokenFixture.insertToken({
      address: "0xUSDT",
      chainId: ChainIds.mainnet,
      name: "USDT",
      symbol: "USDT",
      decimals: 6,
    });
    const daiPrice = await historicMarketPriceFixture.insertPrice({
      symbol: "DAI",
      usd: "2",
    });
    const usdtPrice = await historicMarketPriceFixture.insertPrice({
      symbol: "USDT",
      usd: "1",
    });
    deposit = await depositFixture.insertDeposit({
      tokenId: inputToken.id,
      amount: new BigNumber(10).pow(inputToken.decimals).multipliedBy(5).toString(),
      outputTokenId: outputToken.id,
      outputAmount: new BigNumber(10).pow(outputToken.decimals).multipliedBy(9).toString(),
      priceId: daiPrice.id,
      outputTokenPriceId: usdtPrice.id,
    });
    deposit.token = inputToken;
    deposit.outputToken = outputToken;  
    deposit.price = daiPrice;
    deposit.outputTokenPrice = usdtPrice;
  });

  afterEach(async () => {
    await tokenFixture.deleteAllTokens();
    await historicMarketPriceFixture.deleteAllPrices();
    await depositFixture.deleteAllDeposits();
  });

  it("should compute bridge fee", async () => {
    const bridgeFee = depositService.computeBridgeFeeForV3Deposit(deposit);
    console.log({
      bridgeFeeAmount: bridgeFee.bridgeFeeAmount.toString(),
      bridgeFeePct: bridgeFee.bridgeFeePct.toString(),
      bridgeFeeUsd: bridgeFee.bridgeFeeUsd.toString(),
    });
    expect(bridgeFee.bridgeFeeUsd.toString()).toEqual("1");
    expect(bridgeFee.bridgeFeePct.toString()).toBe(new BigNumber(10).pow(18).multipliedBy(0.1).toString());
    expect(bridgeFee.bridgeFeeAmount.toString()).toBe(new BigNumber(10).pow(18).multipliedBy(0.5).toString());
  });
});
