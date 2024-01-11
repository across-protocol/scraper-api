import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";

import { DepositFixture } from "../src/modules/deposit/adapter/db/deposit-fixture";
import { AppModule } from "../src/app.module";
import { Role } from "../src/modules/auth/entry-points/http/roles";
import { configValues } from "../src/modules/configuration";
import { RunMode } from "../src/dynamic-module";
import { RewardsWindowJobFixture } from "../src/modules/rewards/adapter/db/rewards-window-job-fixture";
import { ValidationPipe } from "../src/validation.pipe";
import { RewardsType, RewardsWindowJobStatus } from "../src/modules/rewards/model/RewardsWindowJob.entity";

let app: INestApplication;
let depositFixture: DepositFixture;
let rewardsWindowJobFixture: RewardsWindowJobFixture;
let adminJwt: string;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runModes: [RunMode.Normal, RunMode.Test, RunMode.Scraper] })],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  depositFixture = app.get(DepositFixture);
  rewardsWindowJobFixture = app.get(RewardsWindowJobFixture);
  adminJwt = app.get(JwtService).sign({ roles: [Role.Admin] }, { secret: configValues().auth.jwtSecret });

  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe("POST /rewards-window-job", () => {
  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
    await rewardsWindowJobFixture.deleteAll();
  });

  it("return 401", async () => {
    const response = await request(app.getHttpServer())
      .post(`/rewards-window-job`)
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now()),
      });
    expect(response.status).toBe(401);
  });

  it("return 400", async () => {
    const response = await request(app.getHttpServer())
      .post(`/rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now()),
      });
    expect(response.status).toBe(400);
  });

  it("return 201", async () => {
    const response = await request(app.getHttpServer())
      .post(`/rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 1,
        maxDepositDate: new Date(Date.now()),
        rewardsType: RewardsType.ReferralRewards,
      });
    expect(response.status).toBe(201);
    expect(response.body.id).toBe(1);
  });

  it("should create window for op rewards if referral rewards with same window is in progress", async () => {
    await rewardsWindowJobFixture.insert({
      rewardsType: RewardsType.ReferralRewards,
      windowIndex: 0,
      status: RewardsWindowJobStatus.InProgress,
    });
    const response = await request(app.getHttpServer())
      .post(`/rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 0,
        maxDepositDate: new Date(Date.now()),
        rewardsType: RewardsType.OpRewards,
      });
    expect(response.status).toBe(201);
  });

  it("should not create duplicated windows if job is in progress", async () => {
    rewardsWindowJobFixture.insert({
      rewardsType: RewardsType.ReferralRewards,
      windowIndex: 0,
      status: RewardsWindowJobStatus.InProgress,
    });
    const response = await request(app.getHttpServer())
      .post(`/rewards-window-job`)
      .set({ Authorization: `Bearer ${adminJwt}` })
      .send({
        windowIndex: 0,
        maxDepositDate: new Date(Date.now()),
        rewardsType: RewardsType.ReferralRewards,
      });
    expect(response.status).toBe(400);
  });
});
