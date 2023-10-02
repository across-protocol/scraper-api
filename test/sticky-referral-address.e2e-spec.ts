import { INestApplication, Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { DepositFixture } from "../src/modules/deposit/adapter/db/deposit-fixture";
import { AppModule } from "../src/app.module";
import { ReferralService } from "../src/modules/referral/services/service";
import { RunMode } from "../src/dynamic-module";

let app: INestApplication;
let depositFixture: DepositFixture;
let referralService: ReferralService;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runModes: [RunMode.Normal, RunMode.Test, RunMode.Scraper] })],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useLogger(new Logger());
  depositFixture = app.get(DepositFixture);
  referralService = app.get(ReferralService);

  await app.init();
});

afterAll(async () => {
  await app.close();
});

// 1 - depositor A referralAddress B depositDate 1/9
describe("Sticky referral address", () => {
  beforeEach(async () => { });

  afterEach(async () => {
    await depositFixture.deleteAllDeposits();
  });

  it("should set sticky referral address", async () => {
    const deposits = await depositFixture.insertManyDeposits([
      {
        depositorAddr: "A",
        referralAddress: "B",
        stickyReferralAddress: "B",
        depositDate: new Date("2023-09-01"),
      },
      {
        depositorAddr: "A",
        depositDate: new Date("2023-09-02"),
      },
    ]);
    await referralService.computeStickyReferralAddress(deposits[1]);
    let d = await referralService.depositRepository.findOne({ where: { id: deposits[0].id } });
    expect(d.referralAddress).toEqual("B");
    expect(d.stickyReferralAddress).toEqual("B");
    d = await referralService.depositRepository.findOne({ where: { id: deposits[1].id } });
    expect(d.referralAddress).toEqual(null);
    expect(d.stickyReferralAddress).toEqual("B");
  });

  it("should not update sticky referral address for other depositors", async () => {
    const deposits = await depositFixture.insertManyDeposits([
      {
        depositorAddr: "A",
        referralAddress: "B",
        stickyReferralAddress: "B",
        depositDate: new Date("2023-09-01"),
      },
      {
        depositorAddr: "A",
        depositDate: new Date("2023-09-02"),
      },
      {
        depositorAddr: "B",
        depositDate: new Date("2023-09-03"),
      },
    ]);
    await referralService.computeStickyReferralAddress(deposits[1]);
    let d = await referralService.depositRepository.findOne({ where: { id: deposits[0].id } });
    expect(d.referralAddress).toEqual("B");
    expect(d.stickyReferralAddress).toEqual("B");
    d = await referralService.depositRepository.findOne({ where: { id: deposits[1].id } });
    expect(d.referralAddress).toEqual(null);
    expect(d.stickyReferralAddress).toEqual("B");
    d = await referralService.depositRepository.findOne({ where: { id: deposits[2].id } });
    expect(d.referralAddress).toEqual(null);
    expect(d.stickyReferralAddress).toEqual(null);
  });

  it("should process deposits correctly if they are not inserted chronologically in DB ", async () => {
    const deposits = await depositFixture.insertManyDeposits([
      {
        depositorAddr: "A",
        referralAddress: "B",
        stickyReferralAddress: "B",
        depositDate: new Date("2023-09-03"),
      },
      {
        depositorAddr: "A",
        depositDate: new Date("2023-09-02"),
      },
      {
        depositorAddr: "A",
        depositDate: new Date("2023-09-04"),
      },
    ]);
    await referralService.computeStickyReferralAddress(deposits[1]);
    await referralService.computeStickyReferralAddress(deposits[0]);
    let d = await referralService.depositRepository.findOne({ where: { id: deposits[0].id } });
    expect(d.referralAddress).toEqual("B");
    expect(d.stickyReferralAddress).toEqual("B");
    d = await referralService.depositRepository.findOne({ where: { id: deposits[1].id } });
    expect(d.referralAddress).toEqual(null);
    expect(d.stickyReferralAddress).toEqual(null);
    d = await referralService.depositRepository.findOne({ where: { id: deposits[2].id } });
    expect(d.referralAddress).toEqual(null);
    expect(d.stickyReferralAddress).toEqual("B");
  });

  it("should set different sticky referral addresses ", async () => {
    const deposits = await depositFixture.insertManyDeposits([
      {
        depositorAddr: "A",
        referralAddress: "B",
        stickyReferralAddress: "B",
        depositDate: new Date("2023-09-01"),
      },
      {
        depositorAddr: "A",
        depositDate: new Date("2023-09-02"),
      },
      {
        depositorAddr: "A",
        referralAddress: "C",
        stickyReferralAddress: "C",
        depositDate: new Date("2023-09-03"),
      },
      {
        depositorAddr: "A",
        depositDate: new Date("2023-09-04"),
      },
    ]);
    await referralService.computeStickyReferralAddress(deposits[0]);
    await referralService.computeStickyReferralAddress(deposits[1]);
    await referralService.computeStickyReferralAddress(deposits[2]);
    await referralService.computeStickyReferralAddress(deposits[3]);

    let d = await referralService.depositRepository.findOne({ where: { id: deposits[0].id } });
    expect(d.referralAddress).toEqual("B");
    expect(d.stickyReferralAddress).toEqual("B");
    d = await referralService.depositRepository.findOne({ where: { id: deposits[1].id } });
    expect(d.referralAddress).toEqual(null);
    expect(d.stickyReferralAddress).toEqual("B");
    d = await referralService.depositRepository.findOne({ where: { id: deposits[2].id } });
    expect(d.referralAddress).toEqual("C");
    expect(d.stickyReferralAddress).toEqual("C");
    d = await referralService.depositRepository.findOne({ where: { id: deposits[3].id } });
    expect(d.referralAddress).toEqual(null);
    expect(d.stickyReferralAddress).toEqual("C");
  });
});
