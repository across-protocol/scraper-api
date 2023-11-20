import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { constants, ethers } from "ethers";

import {
  DepositFixture,
  mockManyDepositEntities,
  mockDepositEntity,
} from "../src/modules/deposit/adapter/db/deposit-fixture";
import { ValidationPipe } from "../src/validation.pipe";
import { AppModule } from "../src/app.module";
import { RunMode } from "../src/dynamic-module";
import { ReferralService } from "../src/modules/referral/services/service";
import { TokenFixture } from "../src/modules/web3/adapters/db/token-fixture";
import { HistoricMarketPriceFixture } from "../src/modules/market-price/adapters/hmp-fixture";
import { HistoricMarketPrice } from "../src/modules/market-price/model/historic-market-price.entity";
import { Token } from "../src/modules/web3/model/token.entity";

const usdc = {
  address: "0x1",
  symbol: "USDC",
  decimals: 6,
};

let app: INestApplication;
let referralService: ReferralService;
let priceFixture: HistoricMarketPriceFixture;
let tokenFixture: TokenFixture;
let depositFixture: DepositFixture;

let token: Token;
let price: HistoricMarketPrice;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runModes: [RunMode.Normal, RunMode.Test, RunMode.Scraper] })],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();
});

describe("GET /deposits", () => {
  const depositorAddress = "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D";
  // filled deposits with depositIds 10 - 19 and ascending depositDate
  const FILLED_DEPOSITS = mockManyDepositEntities(10, {
    depositIdStartIndex: 10,
    overrides: { status: "filled", depositorAddr: depositorAddress, amount: "10", filled: "10" },
  });
  // pending deposits with depositIds 20 - 29 and ascending depositDate
  const PENDING_DEPOSITS = mockManyDepositEntities(10, {
    depositIdStartIndex: 20,
    overrides: { status: "pending", depositorAddr: depositorAddress, amount: "10" },
  });

  beforeAll(async () => {
    await app.get(DepositFixture).insertManyDeposits([...FILLED_DEPOSITS, ...PENDING_DEPOSITS]);
  });

  it("200 without params", async () => {
    const response = await request(app.getHttpServer()).get("/deposits");
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(10);
    expect(response.body.pagination).toMatchObject({ limit: 10, offset: 0 });
  });

  it("200 with status=filled & limit=5 & address=depositorAddress", async () => {
    const response = await request(app.getHttpServer()).get(
      `/deposits?status=filled&limit=5&address=${depositorAddress}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(5);
    expect(response.body.pagination).toMatchObject({ limit: 5, offset: 0, total: FILLED_DEPOSITS.length });
    expect(response.body.deposits[0].depositId).toBe(19);
  });

  it("200 with status=filled & limit=5 & skip=5", async () => {
    const response = await request(app.getHttpServer()).get("/deposits?status=filled&limit=5&offset=5");
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(5);
    expect(response.body.pagination).toMatchObject({ limit: 5, offset: 5, total: FILLED_DEPOSITS.length });
    expect(response.body.deposits[0].depositId).toBe(14);
  });

  it("200 with empty array", async () => {
    const response = await request(app.getHttpServer()).get(`/deposits?address=${constants.AddressZero}`);
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(0);
  });

  it("400 for invalid status", async () => {
    const response = await request(app.getHttpServer()).get("/deposits?status=invalid");
    expect(response.status).toBe(400);
  });

  it("400 for invalid offset", async () => {
    const response = await request(app.getHttpServer()).get("/deposits?offset=invalid");
    expect(response.status).toBe(400);
  });

  it("400 for invalid address", async () => {
    const response = await request(app.getHttpServer()).get(`/deposits?address=invalid`);
    expect(response.status).toBe(400);
  });

  it("400 for negative offset", async () => {
    const response = await request(app.getHttpServer()).get("/deposits?offset=-10");
    expect(response.status).toBe(400);
  });

  it("400 for invalid limit", async () => {
    const response = await request(app.getHttpServer()).get("/deposits?limit=invalid");
    expect(response.status).toBe(400);
  });

  it("400 for negative offset", async () => {
    const response = await request(app.getHttpServer()).get("/deposits?limit=-10");
    expect(response.status).toBe(400);
  });

  afterAll(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
  });
});

describe("GET /deposits/details", () => {
  const depositorAddress = "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D";
  const depositTxHash = "0x91616c035fe2b7432d1549b9a204e29fd7cf3f5d5d9170cd418e5cc7dcc4e3a0";
  const sourceChainId = 1;

  const FILLED_DEPOSIT = mockDepositEntity({
    status: "filled",
    depositorAddr: depositorAddress,
    sourceChainId,
    depositTxHash,
    amount: "10",
    filled: "10",
  });

  beforeAll(async () => {
    await app.get(DepositFixture).insertManyDeposits([FILLED_DEPOSIT]);
  });

  it("200 with for correct params", async () => {
    const response = await request(app.getHttpServer()).get(
      `/deposits/details?depositTxHash=${depositTxHash}&originChainId=${sourceChainId}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("filled");
  });

  it("404 for non existent depositTxHash", async () => {
    const response = await request(app.getHttpServer()).get(
      `/deposits/details?depositTxHash=0x&originChainId=${sourceChainId}`,
    );
    expect(response.status).toBe(404);
  });

  it("404 for non existent originChainId", async () => {
    const response = await request(app.getHttpServer()).get(
      `/deposits/details?depositTxHash=${depositTxHash}&originChainId=10`,
    );
    expect(response.status).toBe(404);
  });

  it("400 for invalid originChainId", async () => {
    const response = await request(app.getHttpServer()).get(
      `/deposits/details?depositTxHash=${depositTxHash}&originChainId=invalid`,
    );
    expect(response.status).toBe(400);
  });

  afterAll(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
  });
});

describe("GET /etl/referral-deposits", () => {
  const date = "2022-01-01";

  beforeAll(async () => {
    referralService = app.get(ReferralService);
    priceFixture = app.get(HistoricMarketPriceFixture);
    tokenFixture = app.get(TokenFixture);
    [token, price] = await Promise.all([
      tokenFixture.insertToken({ ...usdc }),
      priceFixture.insertPrice({ symbol: usdc.symbol, usd: "1" }),
    ]);

    const depositorAddr = "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D";
    const deposits = mockManyDepositEntities(5, {
      depositIdStartIndex: 10,
      overrides: {
        status: "filled",
        depositorAddr,
        amount: "10",
        filled: "10",
        referralAddress: depositorAddr,
        stickyReferralAddress: depositorAddr,
        depositDate: new Date(date),
        bridgeFeePct: ethers.utils.parseEther("0.01").toString(),
        priceId: price.id,
        tokenId: token.id,
      },
    });

    await app.get(DepositFixture).insertManyDeposits(deposits);
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();
  });

  afterAll(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
    await Promise.all([tokenFixture.deleteAllTokens(), priceFixture.deleteAllPrices()]);
  });

  it("should fail if date is not provided", async () => {
    const response = await request(app.getHttpServer()).get("/etl/referral-deposits");
    expect(response.status).toBe(400);
  });

  it("should return referral deposits", async () => {
    const response = await request(app.getHttpServer()).get("/etl/referral-deposits").query({ date });
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(5);
  });

  it("should return no referral deposits", async () => {
    const response = await request(app.getHttpServer()).get("/etl/referral-deposits").query({ date: "2022-01-02" });
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(0);
  });
});

describe("GET /deposits/pending", () => {
  beforeAll(async () => {
    depositFixture = app.get(DepositFixture);
  });

  beforeEach(async () => {
    await depositFixture.insertManyDeposits([
      { status: "pending", depositRelayerFeePct: "0.1", suggestedRelayerFeePct: "0.1" },
      { status: "pending", depositRelayerFeePct: "0.1", suggestedRelayerFeePct: "0.1" },
    ]);
    await depositFixture.insertManyDeposits([
      { status: "filled", depositRelayerFeePct: "0.1", suggestedRelayerFeePct: "0.1" },
      { status: "filled", depositRelayerFeePct: "0.1", suggestedRelayerFeePct: "0.1" },
    ]);
  });

  it("should get pending deposits", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/pending");
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(2);
    expect(response.body.pagination).toMatchObject({ limit: 10, offset: 0 });
  });

  it("400 for invalid offset", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/pending?offset=invalid");
    expect(response.status).toBe(400);
  });
  it("400 for invalid limit", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/pending?limit=invalid");
    expect(response.status).toBe(400);
  });

  afterEach(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
  });
});

describe("GET /v2/deposits", () => {
  beforeAll(async () => {
    depositFixture = app.get(DepositFixture);
  });

  beforeEach(async () => {
    await depositFixture.insertManyDeposits([
      {
        status: "pending",
        sourceChainId: 1,
        destinationChainId: 10,
      },
      {
        status: "pending",
        sourceChainId: 137,
        destinationChainId: 42161,
      },
      {
        depositId: 3,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 10,
        tokenAddr: usdc.address,
      },
      {
        depositId: 4,
        status: "filled",
        sourceChainId: 137,
        destinationChainId: 42161,
      },
    ]);
  });

  it("200 without query params", async () => {
    const response = await request(app.getHttpServer()).get("/v2/deposits");
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(4);
  });

  it("200 for 'status' query params", async () => {
    const response = await request(app.getHttpServer()).get("/v2/deposits").query({ status: "filled" });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(2);
  });

  it("200 for 'originChainId' and 'destinationChainId' query params", async () => {
    const response = await request(app.getHttpServer())
      .get("/v2/deposits")
      .query({ originChainId: 1, destinationChainId: 10 });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(2);
  });

  it("200 for 'tokenAddress' query params", async () => {
    const response = await request(app.getHttpServer()).get("/v2/deposits").query({ tokenAddress: usdc.address });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(1);
  });

  afterEach(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
  });
});

describe("GET /deposits/tx-page", () => {
  beforeAll(async () => {
    depositFixture = app.get(DepositFixture);
  });

  beforeEach(async () => {
    await depositFixture.insertManyDeposits([
      {
        depositId: 1,
        status: "pending",
        sourceChainId: 1,
        destinationChainId: 10,
        // unprofitable deposit
        depositDate: new Date("2021-01-01"),
        depositRelayerFeePct: "0",
        suggestedRelayerFeePct: "1",
      },
      {
        depositId: 2,
        status: "pending",
        sourceChainId: 137,
        destinationChainId: 42161,
        depositDate: new Date(Date.now()),
        depositRelayerFeePct: "2",
        suggestedRelayerFeePct: "1",
      },
      {
        depositId: 3,
        status: "filled",
        sourceChainId: 1,
        destinationChainId: 10,
        tokenAddr: usdc.address,
        depositDate: new Date(Date.now() - 30_000),
        depositRelayerFeePct: "2",
        suggestedRelayerFeePct: "1",
      },
      {
        depositId: 4,
        status: "filled",
        sourceChainId: 137,
        destinationChainId: 42161,
        depositDate: new Date(Date.now()),
        depositRelayerFeePct: "2",
        suggestedRelayerFeePct: "1",
      },
    ]);
  });

  it("200 without query params", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/tx-page");
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(4);
  });

  it("200 for 'status' query params", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/tx-page").query({ status: "filled" });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(2);
  });

  it("200 for 'originChainId' and 'destinationChainId' query params", async () => {
    const response = await request(app.getHttpServer())
      .get("/deposits/tx-page")
      .query({ originChainId: 1, destinationChainId: 10 });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(2);
  });

  it("200 for 'tokenAddress' query params", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/tx-page").query({ tokenAddress: usdc.address });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(1);
  });

  it("200 for 'skipOldUnprofitable' query params", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/tx-page").query({ skipOldUnprofitable: true });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(3);
  });

  it("200 for 'orderBy' query params", async () => {
    const response = await request(app.getHttpServer()).get("/deposits/tx-page").query({ orderBy: "status" });
    expect(response.status).toBe(200);
    expect(response.body.deposits).toHaveLength(4);
    expect(response.body.deposits[0].depositId).toBe(2);
    expect(response.body.deposits[2].depositId).toBe(4);
  });

  afterEach(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
  });
});

afterAll(async () => {
  await app.close();
});
