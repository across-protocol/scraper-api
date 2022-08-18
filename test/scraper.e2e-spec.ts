import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DepositFixture } from "../src/modules/scraper/adapter/db/deposit-fixture";
import { AppModule } from "../src/app.module";
import { QueryFailedError } from "typeorm";

describe("Scraper module", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("should not store the same deposit twice times", async () => {
    await app.get(DepositFixture).insertDeposit({ depositId: 1, sourceChainId: 1, destinationChainId: 10 });
    await expect(
      app.get(DepositFixture).insertDeposit({ depositId: 1, sourceChainId: 1, destinationChainId: 10 }),
    ).rejects.toThrow(QueryFailedError);
  });

  afterAll(async () => {
    await app.get(DepositFixture).deleteAllDeposits();
    await app.close();
  });
});
