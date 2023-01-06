import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { RunMode } from "../src/dynamic-module";

describe("Run modes", () => {
  it("should start app in normal mode", async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule.forRoot({ runModes: [RunMode.Normal] })],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.statusCode).toEqual(200);
    await app.close();
  });

  it("should start app in scraper mode", async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule.forRoot({ runModes: [RunMode.Scraper] })],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.statusCode).toEqual(200);
    await app.close();
  });
});
