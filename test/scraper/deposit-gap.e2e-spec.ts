import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DepositGapCheckFixture } from "../../src/modules/scraper/adapter/db/DepositGapCheckFixture";
import { DepositGapService } from "../../src/modules/scraper/service/DepositGapService";
import { AppModule } from "../../src/app.module";
import { RunMode } from "../../src/dynamic-module";
import { ValidationPipe } from "../../src/validation.pipe";
import { ChainIds } from "../../src/modules/web3/model/ChainId";
import { DepositFixture } from "../../src/modules/deposit/adapter/db/deposit-fixture";

let app: INestApplication;
let depositGapCheckFixture: DepositGapCheckFixture;
let depositFixture: DepositFixture;
let depositGapService: DepositGapService;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runModes: [RunMode.Normal, RunMode.Test, RunMode.Scraper] })],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  depositGapCheckFixture = app.get(DepositGapCheckFixture);
  depositFixture = app.get(DepositFixture);
  depositGapService = app.get(DepositGapService);
});

afterAll(async () => {
  await app.close();
});

describe("DepositGapService::getLastDepositThatPassedGapCheck", () => {
  beforeEach(async () => {
    await depositGapCheckFixture.deleteAllDepositGapChecks();
  });

  afterEach(async () => {
    await depositGapCheckFixture.deleteAllDepositGapChecks();
  });

  it("should return null if no gap checks in the db", async () => {
    const result = await depositGapService.getLastDepositThatPassedGapCheck(ChainIds.optimism);
    expect(result).toBeNull();
  });

  it("should return the last deposit id that passed gap check", async () => {
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 0, originChainId: ChainIds.mainnet, passed: true });
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 1, originChainId: ChainIds.mainnet, passed: true });
    const result1 = await depositGapService.getLastDepositThatPassedGapCheck(ChainIds.mainnet);
    expect(result1.depositId).toBe(1);
  });
});

describe("DepositGapService::getDepositToStartGapCheck", () => {
  beforeEach(async () => {
    await depositGapCheckFixture.deleteAllDepositGapChecks();
  });

  afterEach(async () => {
    await depositGapCheckFixture.deleteAllDepositGapChecks();
  });

  it("should start to check deposit from the spoke pool config", async () => {
    const depositId = await depositGapService.getDepositToStartGapCheck(ChainIds.mainnet);
    expect(depositId).toBe(0);
  });

  it("should start to check deposit from the last deposit gap check", async () => {
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 0, originChainId: ChainIds.mainnet, passed: true });
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 1, originChainId: ChainIds.mainnet, passed: true });
    const depositId = await depositGapService.getDepositToStartGapCheck(ChainIds.mainnet);
    expect(depositId).toBe(2);
  });
});

describe("DepositGapService::checkDepositGaps", () => {
  beforeEach(async () => {
    await depositGapCheckFixture.deleteAllDepositGapChecks();
    await depositFixture.deleteAllDeposits();
  });

  afterEach(async () => {
    await depositGapCheckFixture.deleteAllDepositGapChecks();
    await depositFixture.deleteAllDeposits();
  });

  it("should be no gaps if no deposits", async () => {
    const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await depositGapService.checkDepositGaps(
      ChainIds.mainnet,
    );
    expect(gapIntervals.length).toBe(0);
    expect(lastDepositId).toBeUndefined();
    expect(gapCheckPassDepositId).toBeUndefined();
  });

  it("should be no gaps if a single deposit", async () => {
    await depositFixture.insertDeposit({ depositId: 0, sourceChainId: ChainIds.mainnet });
    const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await depositGapService.checkDepositGaps(
      ChainIds.mainnet,
    );
    expect(gapIntervals.length).toBe(0);
    expect(lastDepositId).toBe(0);
    expect(gapCheckPassDepositId).toBe(0);
  });

  it("should be no gaps if multiple deposit", async () => {
    await depositFixture.insertDeposit({ depositId: 0, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 1, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 2, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 3, sourceChainId: ChainIds.mainnet });
    const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await depositGapService.checkDepositGaps(
      ChainIds.mainnet,
    );
    expect(gapIntervals.length).toBe(0);
    expect(lastDepositId).toBe(3);
    expect(gapCheckPassDepositId).toBe(3);
  });

  it("should detect gaps", async () => {
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 0, originChainId: ChainIds.mainnet, passed: true });
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 1, originChainId: ChainIds.mainnet, passed: true });
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 2, originChainId: ChainIds.mainnet, passed: true });
    await depositFixture.insertDeposit({ depositId: 0, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 1, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 2, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 3, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 5, sourceChainId: ChainIds.mainnet });
    const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await depositGapService.checkDepositGaps(
      ChainIds.mainnet,
    );
    expect(gapIntervals).toStrictEqual([{ fromDepositId: 4, toDepositId: 4 }]);
    expect(lastDepositId).toBe(5);
    expect(gapCheckPassDepositId).toBe(3);
  });

  it("should detect gaps", async () => {
    await depositFixture.insertDeposit({ depositId: 0, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 1, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 2, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 3, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 5, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 10, sourceChainId: ChainIds.mainnet });
    const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await depositGapService.checkDepositGaps(
      ChainIds.mainnet,
    );
    expect(gapIntervals).toStrictEqual([
      { fromDepositId: 4, toDepositId: 4 },
      { fromDepositId: 6, toDepositId: 9 },
    ]);
    expect(lastDepositId).toBe(10);
    expect(gapCheckPassDepositId).toBe(3);
  });

  it("should detect gaps", async () => {
    await depositFixture.insertDeposit({ depositId: 1, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 2, sourceChainId: ChainIds.mainnet });
    const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await depositGapService.checkDepositGaps(
      ChainIds.mainnet,
    );
    expect(gapIntervals).toStrictEqual([{ fromDepositId: 0, toDepositId: 0 }]);
    expect(lastDepositId).toBe(2);
    expect(gapCheckPassDepositId).toBeUndefined();
  });

  it("should detect gaps", async () => {
    await depositGapCheckFixture.insertDepositGapCheck({ depositId: 0, originChainId: ChainIds.mainnet, passed: true });
    await depositFixture.insertDeposit({ depositId: 0, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 3, sourceChainId: ChainIds.mainnet });
    await depositFixture.insertDeposit({ depositId: 5, sourceChainId: ChainIds.mainnet });
    const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await depositGapService.checkDepositGaps(
      ChainIds.mainnet,
    );
    expect(gapIntervals).toStrictEqual([
      { fromDepositId: 1, toDepositId: 2 },
      { fromDepositId: 4, toDepositId: 4 },
    ]);
    expect(lastDepositId).toBe(5);
    expect(gapCheckPassDepositId).toBeUndefined();
  });
});
