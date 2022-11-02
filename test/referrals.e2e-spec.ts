import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { utils } from "ethers";

import { DepositFixture, mockDepositEntity } from "../src/modules/scraper/adapter/db/deposit-fixture";
import { ClaimFixture } from "../src/modules/scraper/adapter/db/claim-fixture";
import { TokenFixture } from "../src/modules/web3/adapters/db/token-fixture";
import { HistoricMarketPriceFixture } from "../src/modules/market-price/adapters/hmp-fixture";
import { AppModule } from "../src/app.module";
import { ReferralService } from "../src/modules/referral/services/service";
import { Token } from "../src/modules/web3/model/token.entity";
import { HistoricMarketPrice } from "../src/modules/market-price/model/historic-market-price.entity";

const referrer = "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D";
const usdc = {
  address: "0x1",
  symbol: "USDC",
  decimals: 6,
};
const tier5DepositAmount = utils.parseUnits("500000", usdc.decimals).toString();
const dayInMS = 24 * 60 * 60 * 1000;

let app: INestApplication;
let depositFixture: DepositFixture;
let claimFixture: ClaimFixture;
let priceFixture: HistoricMarketPriceFixture;
let tokenFixture: TokenFixture;
let referralService: ReferralService;

let token: Token;
let price: HistoricMarketPrice;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  depositFixture = app.get(DepositFixture);
  claimFixture = app.get(ClaimFixture);
  priceFixture = app.get(HistoricMarketPriceFixture);
  tokenFixture = app.get(TokenFixture);
  referralService = app.get(ReferralService);

  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("GET /referrals/summary", () => {
  beforeAll(async () => {
    token = await tokenFixture.insertToken({ ...usdc });
    price = await priceFixture.insertPrice({ symbol: usdc.symbol, usd: "1" });

    token = await tokenFixture.insertToken({ ...usdc });
    price = await priceFixture.insertPrice({ symbol: usdc.symbol, usd: "1" });
  });

  afterAll(async () => {
    await Promise.all([tokenFixture.deleteAllTokens(), priceFixture.deleteAllPrices()]);
  });

  beforeEach(async () => {
    await referralService.refreshMaterializedView();
  });

  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
    await claimFixture.deleteAllClaims();
  });

  it("return tier 1", async () => {
    const response = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(response.status).toBe(200);
    expect(response.body.tier).toBe(1);
  });

  it("return tier 2 by num transfers", async () => {
    await depositFixture.insertManyDeposits(
      Array.from(Array(3).keys()).map((i) =>
        mockDepositEntity({
          depositId: i + 1,
          referralAddress: referrer,
          stickyReferralAddress: referrer,
          status: "filled",
          tokenId: token.id,
          priceId: price.id,
          depositorAddr: `0x${i}`,
        }),
      ),
    );
    await referralService.refreshMaterializedView();

    const response = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(response.status).toBe(200);
    expect(response.body.tier).toBe(2);
  });

  it("reset to tier 1 from 5 after claim", async () => {
    await depositFixture.insertManyDeposits([
      mockDepositEntity({
        depositId: 1,
        referralAddress: referrer,
        stickyReferralAddress: referrer,
        status: "filled",
        tokenId: token.id,
        priceId: price.id,
        amount: tier5DepositAmount,
        depositorAddr: `0x1`,
        depositDate: new Date(Date.now() - dayInMS),
      }),
    ]);
    await referralService.refreshMaterializedView();

    const responseBeforeClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseBeforeClaim.status).toBe(200);
    expect(responseBeforeClaim.body.tier).toBe(5);

    await claimFixture.insertClaim({
      account: referrer,
      claimedAt: new Date(Date.now()),
      windowIndex: 1,
    });
    await referralService.refreshMaterializedView();

    const responseAfterClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseAfterClaim.status).toBe(200);
    expect(responseAfterClaim.body.tier).toBe(1);
  });

  it("reset to tier 5 from 5 after claim", async () => {
    const tier5DepositBase = {
      referralAddress: referrer,
      stickyReferralAddress: referrer,
      amount: tier5DepositAmount,
      tokenId: token.id,
      priceId: price.id,
    };

    await depositFixture.insertManyDeposits([
      mockDepositEntity({
        ...tier5DepositBase,
        status: "filled",
        depositId: 1,
        depositDate: new Date(Date.now() - 2 * dayInMS), // t = -2
      }),
      mockDepositEntity({
        ...tier5DepositBase,
        status: "filled",
        depositId: 2,
        depositDate: new Date(Date.now()), // t = 0
      }),
    ]);
    await referralService.refreshMaterializedView();

    const responseBeforeClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseBeforeClaim.status).toBe(200);
    expect(responseBeforeClaim.body.tier).toBe(5);

    await claimFixture.insertClaim({
      account: referrer,
      windowIndex: 1,
      claimedAt: new Date(Date.now() - dayInMS), // t = -1
    });
    await referralService.refreshMaterializedView();

    const responseAfterClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseAfterClaim.status).toBe(200);
    expect(responseAfterClaim.body.tier).toBe(5);
  });
});
