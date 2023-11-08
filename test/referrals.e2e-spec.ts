import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ethers, utils } from "ethers";

import { DepositFixture, mockDepositEntity } from "../src/modules/deposit/adapter/db/deposit-fixture";
import { ClaimFixture } from "../src/modules/airdrop/adapter/db/claim-fixture";
import { TokenFixture } from "../src/modules/web3/adapters/db/token-fixture";
import { HistoricMarketPriceFixture } from "../src/modules/market-price/adapters/hmp-fixture";
import { AppModule } from "../src/app.module";
import { ReferralService } from "../src/modules/referral/services/service";
import { Token } from "../src/modules/web3/model/token.entity";
import { HistoricMarketPrice } from "../src/modules/market-price/model/historic-market-price.entity";
import { Role } from "../src/modules/auth/entry-points/http/roles";
import { configValues } from "../src/modules/configuration";
import { RunMode } from "../src/dynamic-module";
import { wait } from "../src/utils";
import { ReferralRewardsWindowJobFixture } from "../src/modules/referral/adapter/db/referral-rewards-window-job-fi";

const referrer = "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D";
const depositor = "0xdf120Bf3AEE9892f213B1Ba95035a60682D637c3";
const usdc = {
  address: "0x1",
  symbol: "USDC",
  decimals: 6,
};
const tier5DepositAmount = utils.parseUnits("500000", usdc.decimals).toString();
const tier4DepositAmount = utils.parseUnits("250000", usdc.decimals).toString();
const dayInMS = 24 * 60 * 60 * 1000;

let app: INestApplication;
let depositFixture: DepositFixture;
let claimFixture: ClaimFixture;
let referralRewardsWindowJobFixture: ReferralRewardsWindowJobFixture;
let priceFixture: HistoricMarketPriceFixture;
let tokenFixture: TokenFixture;
let referralService: ReferralService;

let token: Token;
let price: HistoricMarketPrice;
let adminJwt: string;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runModes: [RunMode.Normal, RunMode.Test, RunMode.Scraper] })],
  }).compile();

  app = moduleFixture.createNestApplication();
  depositFixture = app.get(DepositFixture);
  claimFixture = app.get(ClaimFixture);
  priceFixture = app.get(HistoricMarketPriceFixture);
  tokenFixture = app.get(TokenFixture);
  referralService = app.get(ReferralService);
  referralRewardsWindowJobFixture = app.get(ReferralRewardsWindowJobFixture);
  adminJwt = app.get(JwtService).sign({ roles: [Role.Admin] }, { secret: configValues().auth.jwtSecret });

  await app.init();

  [token, price] = await Promise.all([
    tokenFixture.insertToken({ ...usdc }),
    priceFixture.insertPrice({ symbol: usdc.symbol, usd: "1" }),
  ]);
});

afterAll(async () => {
  await Promise.all([tokenFixture.deleteAllTokens(), priceFixture.deleteAllPrices()]);

  await app.close();
});

describe("POST /referrals/merkle-distribution", () => {
  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
  });

  it("return 401", async () => {
    const response = await request(app.getHttpServer())
      .post(`/referral-rewards-window-job`)
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now() + dayInMS),
      });
    expect(response.status).toBe(401);
  });

  it("return 201 for success and 400 for duplicate window", async () => {
    await depositFixture.insertManyDeposits([
      mockDepositEntity({
        depositId: 1,
        referralAddress: referrer,
        stickyReferralAddress: referrer,
        status: "filled",
        tokenId: token.id,
        priceId: price.id,
        depositorAddr: depositor,
        amount: tier5DepositAmount,
        depositDate: new Date(),
        bridgeFeePct: ethers.utils.parseEther("0.01").toString(), // 1%
      }),
    ]);
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();

    const successResponse = await request(app.getHttpServer())
      .post(`/referral-rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now() + dayInMS),
      });
    await wait(1);
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();
    const duplicateWindowResponse = await request(app.getHttpServer())
      .post(`/referral-rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now() + dayInMS),
      });
    await wait(1);
    const jobResponse = await request(app.getHttpServer())
      .get(`/referral-rewards-window-job/${duplicateWindowResponse.body.id}`)
      .set({ Authorization: `Bearer ${adminJwt}` });
    expect(successResponse.status).toBe(201);
    expect(successResponse.body.status).toBe("InProgress");
    expect(duplicateWindowResponse.status).toBe(201);
    expect(jobResponse.body.job.status).toBe("Failed");
  });
});

describe("DELETE /referrals/merkle-distribution", () => {
  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
    await referralRewardsWindowJobFixture.deleteAll();
  });

  it("return 401", async () => {
    const response = await request(app.getHttpServer()).delete(`/referrals/merkle-distribution`).send({
      windowIndex: 1,
    });
    expect(response.status).toBe(401);
  });

  it("return 201", async () => {
    await depositFixture.insertManyDeposits([
      mockDepositEntity({
        depositId: 1,
        referralAddress: referrer,
        stickyReferralAddress: referrer,
        status: "filled",
        tokenId: token.id,
        priceId: price.id,
        depositorAddr: depositor,
        amount: tier5DepositAmount,
        depositDate: new Date(),
        bridgeFeePct: ethers.utils.parseEther("0.01").toString(), // 1%
      }),
    ]);
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();

    const firstPostResponse = await request(app.getHttpServer())
      .post(`/referral-rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now() + dayInMS),
      });
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();
    const deleteResponse = await request(app.getHttpServer())
      .delete(`/referrals/merkle-distribution`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 1,
      });
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();
    const secondPostResponse = await request(app.getHttpServer())
      .post(`/referral-rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now() + dayInMS),
      });
    expect(firstPostResponse.status).toBe(201);
    expect(firstPostResponse.body.status).toBe("InProgress");
    expect(deleteResponse.status).toBe(200);
    expect(secondPostResponse.body.status).toBe("InProgress");
  });
});

describe("GET /referrals/summary", () => {
  beforeEach(async () => {
    await referralService.cumputeReferralStats();
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

  it("return only referral rate field", async () => {
    const response = await request(app.getHttpServer()).get(
      `/referrals/summary?address=${referrer}&fields[]=referralRate&fields[]=tier`,
    );
    expect(response.status).toBe(200);
    expect(response.body.referralRate).toBe(0.4);
    expect(Object.keys(response.body).length).toBe(2);
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
    await referralService.cumputeReferralStats();
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
        rewardsWindowIndex: 1,
      }),
    ]);
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();

    const responseBeforeClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseBeforeClaim.status).toBe(200);
    expect(responseBeforeClaim.body.tier).toBe(5);

    await claimFixture.insertClaim({
      account: referrer,
      windowIndex: 1,
    });
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();

    const responseAfterClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseAfterClaim.status).toBe(200);
    expect(responseAfterClaim.body.tier).toBe(1);
  });

  it("reset to tier 4 from 5 after claim", async () => {
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
        rewardsWindowIndex: 1,
      }),
      mockDepositEntity({
        ...tier5DepositBase,
        amount: tier4DepositAmount,
        status: "filled",
        depositId: 2,
        rewardsWindowIndex: 2,
      }),
    ]);
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();

    const responseBeforeClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseBeforeClaim.status).toBe(200);
    expect(responseBeforeClaim.body.tier).toBe(5);

    await claimFixture.insertClaim({
      account: referrer,
      windowIndex: 1,
    });
    await referralService.cumputeReferralStats();
    await referralService.refreshMaterializedView();

    const responseAfterClaim = await request(app.getHttpServer()).get(`/referrals/summary?address=${referrer}`);
    expect(responseAfterClaim.status).toBe(200);
    expect(responseAfterClaim.body.tier).toBe(4);
  });
});
