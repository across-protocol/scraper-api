import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DepositFixture } from "../src/modules/scraper/adapter/db/deposit-fixture";
import { AppModule } from "../src/app.module";
import { QueryFailedError } from "typeorm";
import { FillEventsConsumer } from "../src/modules/scraper/adapter/messaging/FillEventsConsumer";
import { FillEventsQueueMessage } from "../src/modules/scraper/adapter/messaging";
import { RunMode } from "../src/dynamic-module";

describe("Scraper module", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule.forRoot({ runMode: RunMode.Test })],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("should not store the same deposit twice", async () => {
    await app.get(DepositFixture).insertDeposit({ depositId: 1, sourceChainId: 1, destinationChainId: 10 });
    await expect(
      app.get(DepositFixture).insertDeposit({ depositId: 1, sourceChainId: 1, destinationChainId: 10 }),
    ).rejects.toThrow(QueryFailedError);
  });

  it("should not process the same fill event twice", async () => {
    let deposit = await app
      .get(DepositFixture)
      .insertDeposit({ depositId: 1, sourceChainId: 1, destinationChainId: 10 });
    const fillEventMessage: FillEventsQueueMessage = {
      appliedRelayerFeePct: "0",
      depositId: 1,
      fillAmount: "0",
      originChainId: 1,
      realizedLpFeePct: "0",
      totalFilledAmount: "0",
      transactionHash: "0x",
      destinationToken: "0x",
    };
    deposit = await app.get(FillEventsConsumer).processFillEventQueueMessage(deposit, fillEventMessage);
    const isFillTxAlreadyProcessed = app.get(FillEventsConsumer).fillTxAlreadyProcessed(deposit, fillEventMessage);
    expect(isFillTxAlreadyProcessed).toStrictEqual(true);
  });

  afterEach(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
  });

  afterAll(async () => {
    await app.close();
  });
});
