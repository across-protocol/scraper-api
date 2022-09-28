import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { constants } from "ethers";

import { DepositFixture, mockManyDepositEntities } from "../src/modules/scraper/adapter/db/deposit-fixture";
import { ValidationPipe } from "../src/validation.pipe";
import { AppModule } from "../src/app.module";
import { RunMode } from "../src/dynamic-module";

let app: INestApplication;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runMode: RunMode.Test })],
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
    overrides: { status: "filled", depositorAddr: depositorAddress },
  });
  // pending deposits with depositIds 20 - 29 and ascending depositDate
  const PENDING_DEPOSITS = mockManyDepositEntities(10, {
    depositIdStartIndex: 20,
    overrides: { status: "pending", depositorAddr: depositorAddress },
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

afterAll(async () => {
  await app.close();
});
