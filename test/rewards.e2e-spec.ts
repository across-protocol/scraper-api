import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DateTime } from "luxon";

import { DepositFixture } from "../src/modules/deposit/adapter/db/deposit-fixture";
import { ValidationPipe } from "../src/validation.pipe";
import { AppModule } from "../src/app.module";
import { RunMode } from "../src/dynamic-module";
import { ReferralService } from "../src/modules/referral/services/service";
import { TokenFixture } from "../src/modules/web3/adapters/db/token-fixture";
import { HistoricMarketPriceFixture } from "../src/modules/market-price/adapters/hmp-fixture";
import { HistoricMarketPrice } from "../src/modules/market-price/model/historic-market-price.entity";
import { Token } from "../src/modules/web3/model/token.entity";
import { RewardFixture } from "../src/modules/rewards/adapter/db/reward-fixture";

const usdc = {
  address: "0x1",
  symbol: "USDC",
  decimals: 6,
};
const userAddress = "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D";

let app: INestApplication;
let referralService: ReferralService;
let priceFixture: HistoricMarketPriceFixture;
let tokenFixture: TokenFixture;
let depositFixture: DepositFixture;
let rewardFixture: RewardFixture;

let token: Token;
let price: HistoricMarketPrice;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runModes: [RunMode.Normal, RunMode.Test, RunMode.Scraper] })],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  depositFixture = app.get(DepositFixture);
  tokenFixture = app.get(TokenFixture);
  rewardFixture = app.get(RewardFixture);
  priceFixture = app.get(HistoricMarketPriceFixture);
  referralService = app.get(ReferralService);
});

describe("GET /rewards/earned", () => {
  beforeAll(async () => {
    [token, price] = await Promise.all([
      tokenFixture.insertToken({ ...usdc }),
      priceFixture.insertPrice({
        symbol: usdc.symbol,
        usd: "1",
      }),
    ]);
  });

  beforeEach(async () => {
    await depositFixture.insertManyDeposits([
      {
        depositId: 1,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 10,
        amount: "10000000", // 10 USDC
        tokenAddr: usdc.address,
        tokenId: token.id,
        priceId: price.id,
        depositDate: DateTime.fromISO("2024-05-01T00:00:00.000Z").toJSDate(),
      },
      {
        depositId: 2,
        status: "filled",
        sourceChainId: 137,
        destinationChainId: 42161,
        amount: "10000000", // 10 USDC
        tokenAddr: usdc.address,
        tokenId: token.id,
        priceId: price.id,
        depositorAddr: userAddress,
        stickyReferralAddress: userAddress,
        bridgeFeePct: "100000000000000000", // 10%
        acxUsdPrice: "1",
        depositDate: DateTime.fromISO("2024-05-01T00:00:00.000Z").toJSDate(),
      },
    ]);
    await rewardFixture.insertOpReward({
      depositPrimaryKey: 1,
      recipient: userAddress,
      metadata: { rate: 0.95 },
      amount: "123000",
      amountUsd: "0.123",
      rewardTokenId: token.id,
      depositDate: DateTime.fromISO("2024-05-01T00:00:00.000Z").toJSDate(),
    });
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();
  });

  it("200 with params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/earned").query({
      userAddress,
    });
    expect(response.status).toBe(200);
    expect(response.body["op-rebates"]).toBe("123000");
    expect(response.body.referrals).toBe("400000000000000000"); // 0.4 ACX
  });

  it("400 without params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/op-rebates/summary");
    expect(response.status).toBe(400);
  });

  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
  });

  afterAll(async () => {
    await Promise.all([tokenFixture.deleteAllTokens(), priceFixture.deleteAllPrices()]);
  });
});

describe("GET /rewards/op-rebates", () => {
  beforeAll(async () => {
    [token] = await Promise.all([tokenFixture.insertToken({ ...usdc })]);
  });

  beforeEach(async () => {
    await depositFixture.insertManyDeposits([
      {
        depositId: 1,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 10,
        tokenAddr: usdc.address,
        tokenId: token.id,
      },
      {
        depositId: 2,
        status: "filled",
        sourceChainId: 137,
        destinationChainId: 42161,
        tokenId: token.id,
      },
    ]);
    await rewardFixture.insertOpReward({
      depositPrimaryKey: 1,
      recipient: userAddress,
      metadata: { rate: 0.95 },
      amount: "1000000000000000000",
      amountUsd: "1",
      rewardTokenId: token.id,
    });
  });

  it("200 with params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/op-rebates").query({
      userAddress,
    });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(1);
    expect(response.body.deposits[0].depositId).toBe(1);
  });

  it("400 without params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/op-rebates");
    expect(response.status).toBe(400);
  });

  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
  });

  afterAll(async () => {
    await tokenFixture.deleteAllTokens();
  });
});

describe("GET /rewards/op-rebates/summary", () => {
  beforeAll(async () => {
    [token, price] = await Promise.all([
      tokenFixture.insertToken({ ...usdc }),
      priceFixture.insertPrice({
        symbol: usdc.symbol,
        usd: "1",
      }),
    ]);
  });

  beforeEach(async () => {
    await depositFixture.insertManyDeposits([
      {
        depositId: 1,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 10,
        amount: "10000000",
        tokenAddr: usdc.address,
        tokenId: token.id,
        priceId: price.id,
      },
    ]);
    await rewardFixture.insertOpReward({
      depositPrimaryKey: 1,
      recipient: userAddress,
      metadata: { rate: 0.95 },
      amount: "1000000000000000000",
      amountUsd: "1",
      rewardTokenId: token.id,
    });
  });

  it("200 with params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/op-rebates/summary").query({
      userAddress,
    });
    expect(response.status).toBe(200);
    expect(response.body.depositsCount).toBe(1);
    expect(response.body.unclaimedRewards).toBe("1000000000000000000");
    expect(response.body.volumeUsd).toBe(10);
  });

  it("400 without params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/op-rebates/summary");
    expect(response.status).toBe(400);
  });

  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
  });

  afterAll(async () => {
    await tokenFixture.deleteAllTokens();
    await priceFixture.deleteAllPrices();
  });
});

describe("GET /rewards/referrals", () => {
  beforeAll(async () => {
    [token, price] = await Promise.all([
      tokenFixture.insertToken({ ...usdc }),
      priceFixture.insertPrice({
        symbol: usdc.symbol,
        usd: "1",
      }),
    ]);
  });

  beforeEach(async () => {
    await depositFixture.insertManyDeposits([
      {
        depositId: 1,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 42161,
        amount: "10000000", // 10 USDC
        tokenAddr: usdc.address,
        tokenId: token.id,
        priceId: price.id,
        stickyReferralAddress: userAddress,
        bridgeFeePct: "100000000000000000", // 10%
        depositDate: DateTime.fromISO("2024-05-01T00:00:00.000Z").toJSDate(),
      },
      {
        depositId: 2,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 42161,
        amount: "10000000", // 10 USDC
        tokenAddr: usdc.address,
        tokenId: token.id,
        priceId: price.id,
        depositorAddr: userAddress,
        stickyReferralAddress: "0x",
        bridgeFeePct: "100000000000000000", // 10%
        depositDate: DateTime.fromISO("2024-05-01T00:00:00.000Z").toJSDate(),
      },
      {
        depositId: 3,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 42161,
        amount: "10000000", // 10 USDC
        tokenAddr: usdc.address,
        tokenId: token.id,
        priceId: price.id,
        depositorAddr: userAddress,
        stickyReferralAddress: userAddress,
        bridgeFeePct: "100000000000000000", // 10%
        depositDate: DateTime.fromISO("2024-05-01T00:00:00.000Z").toJSDate(),
      },
    ]);
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();
  });

  it("200 with params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/referrals").query({
      userAddress,
    });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(3);

    // userAddress is referrer
    expect(response.body.deposits[0].rewards.userRate).toBe(0.75);
    expect(response.body.deposits[0].rewards.referralRate).toBe(0.4);
    expect(response.body.deposits[0].rewards.rate).toBe(0.3); // 0.75 * 0.4

    // userAddress is depositor
    expect(response.body.deposits[1].rewards.userRate).toBe(0.25);
    expect(response.body.deposits[1].rewards.referralRate).toBe(0.4);
    expect(response.body.deposits[1].rewards.rate).toBe(0.1); // 0.25 * 0.4

    // userAddress is both referrer and depositor
    expect(response.body.deposits[2].rewards.userRate).toBe(1);
    expect(response.body.deposits[2].rewards.referralRate).toBe(0.4);
    expect(response.body.deposits[2].rewards.rate).toBe(0.4); // 1 * 0.4
  });

  it("400 without params 'userAddress'", async () => {
    const response = await request(app.getHttpServer()).get("/rewards/op-rebates/summary");
    expect(response.status).toBe(400);
  });

  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
  });

  afterAll(async () => {
    await tokenFixture.deleteAllTokens();
    await priceFixture.deleteAllPrices();
  });
});

afterAll(async () => {
  await app.close();
});
