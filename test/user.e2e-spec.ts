import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { Wallet, constants } from "ethers";

import { ValidationPipe } from "../src/validation.pipe";
import { AppModule } from "../src/app.module";
import { UserService } from "../src/modules/user/services/user.service";
import { User } from "../src/modules/user/model/user.entity";
import { UserFixture } from "../src/modules/user/adapter/db/user-fixture";
import { getRandomInt } from "../src/utils";
import { UserWalletFixture } from "../src/modules/user/adapter/db/user-wallet-fixture";
import { RunMode } from "../src/dynamic-module";

const signer = Wallet.createRandom();
const nonExistingUser = {
  id: getRandomInt(),
  discordId: getRandomInt().toString(),
  shortId: "shortId",
  uuid: "uuid",
};

let app: INestApplication;
let existingUser: User;
let existingUser2: User;
let validJwtForExistingUser: string;
let validJwtForExistingUser2: string;
let validJwtForNonExistingUser: string;
let validSignatureForExistingUser: string;
let validSignatureForNonExistingUser: string;

let userFixture: UserFixture;
let userWalletFixture: UserWalletFixture;

beforeAll(async () => {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule.forRoot({ runMode: RunMode.Test })],
  }).compile();

  app = testingModule.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  userFixture = app.get(UserFixture);
  userWalletFixture = app.get(UserWalletFixture);

  [existingUser, existingUser2] = await Promise.all([
    app.get(UserService).createOrUpdateUserFromDiscord({
      discordAvatar: "avatar",
      discordId: getRandomInt().toString(),
      discordName: "name1",
    }),
    app.get(UserService).createOrUpdateUserFromDiscord({
      discordAvatar: "avatar",
      discordId: getRandomInt().toString(),
      discordName: "name1",
    }),
  ]);
  validJwtForExistingUser = app.get(JwtService).sign({ id: existingUser.id });
  validJwtForExistingUser2 = app.get(JwtService).sign({ id: existingUser2.id });
  validJwtForNonExistingUser = app.get(JwtService).sign({ id: nonExistingUser.id });
  [validSignatureForExistingUser, validSignatureForNonExistingUser] = await Promise.all([
    signer.signMessage(existingUser.discordId),
    signer.signMessage(nonExistingUser.discordId),
  ]);
});

afterAll(async () => {
  await userFixture.deleteAllUsers();
  await app.close();
});

describe("GET /users/me", () => {
  it("401 for unauthorized user", async () => {
    const response = await request(app.getHttpServer()).get("/users/me");
    expect(response.status).toBe(401);
  });

  it("200 with user for valid token", async () => {
    const response = await request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(existingUser.id);
  });
});

describe("GET /users/me/wallets", () => {
  afterEach(async () => {
    await userWalletFixture.deleteAllUserWallets();
  });

  it("401 for unauthorized user", async () => {
    const response = await request(app.getHttpServer()).get("/users/me/wallets");
    expect(response.status).toBe(401);
  });

  it("404 for non-existent user wallet", async () => {
    const response = await request(app.getHttpServer())
      .get("/users/me/wallets")
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(404);
  });

  it("200 with walletAddress for valid token", async () => {
    await createWalletForExistingUser();

    const response = await request(app.getHttpServer())
      .get("/users/me/wallets")
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(200);
    expect(response.body.walletAddress).toBe(signer.address);
  });
});

describe("POST /users/me/wallets", () => {
  afterEach(async () => {
    await userWalletFixture.deleteAllUserWallets();
  });

  it("401 for unauthorized user", async () => {
    const response = await request(app.getHttpServer()).post("/users/me/wallets");
    expect(response.status).toBe(401);
  });

  it("400 for invalid body", async () => {
    const response = await request(app.getHttpServer())
      .post("/users/me/wallets")
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(400);
  });

  it("400 for already linked wallet", async () => {
    await createWalletForExistingUser();

    const response = await request(app.getHttpServer())
      .post("/users/me/wallets")
      .send({
        walletAddress: signer.address,
        signature: validJwtForExistingUser2,
        discordId: existingUser2.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser2}`);

    expect(response.status).toBe(400);
  });

  it("403 for invalid signature", async () => {
    const invalidSignature = await signer.signMessage("wrong message");
    const response = await request(app.getHttpServer())
      .post("/users/me/wallets")
      .send({
        walletAddress: signer.address,
        signature: invalidSignature,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(response.status).toBe(403);
  });

  it("404 for non-existent user", async () => {
    const response = await request(app.getHttpServer())
      .post("/users/me/wallets")
      .send({
        walletAddress: signer.address,
        signature: validSignatureForNonExistingUser,
        discordId: nonExistingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForNonExistingUser}`);

    expect(response.status).toBe(404);
  });

  it("201 for valid body", async () => {
    const response = await request(app.getHttpServer())
      .post("/users/me/wallets")
      .send({
        walletAddress: signer.address,
        signature: validSignatureForExistingUser,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(201);
    expect(response.body.walletAddress).toBe(signer.address);
  });
});

describe("PATCH /users/me/wallets", () => {
  afterEach(async () => {
    await userWalletFixture.deleteAllUserWallets();
  });

  it("401 for unauthorized user", async () => {
    const response = await request(app.getHttpServer()).patch("/users/me/wallets");
    expect(response.status).toBe(401);
  });

  it("400 for invalid body", async () => {
    const response = await request(app.getHttpServer())
      .patch("/users/me/wallets")
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(400);
  });

  it("400 for already linked wallet", async () => {
    await createWalletForExistingUser();

    const response = await request(app.getHttpServer())
      .post("/users/me/wallets")
      .send({
        walletAddress: signer.address,
        signature: validJwtForExistingUser2,
        discordId: existingUser2.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser2}`);

    expect(response.status).toBe(400);
  });

  it("403 for invalid wallet address", async () => {
    await createWalletForExistingUser();

    const response = await request(app.getHttpServer())
      .patch("/users/me/wallets")
      .send({
        walletAddress: constants.AddressZero,
        signature: validSignatureForExistingUser,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(response.status).toBe(403);
  });

  it("404 for non-existent user", async () => {
    const response = await request(app.getHttpServer())
      .patch("/users/me/wallets")
      .send({
        walletAddress: signer.address,
        signature: validSignatureForNonExistingUser,
        discordId: nonExistingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForNonExistingUser}`);

    expect(response.status).toBe(404);
  });

  it("200 for valid body", async () => {
    await createWalletForExistingUser();

    const newSigner = Wallet.createRandom();
    const patchResponse = await request(app.getHttpServer())
      .patch("/users/me/wallets")
      .send({
        walletAddress: newSigner.address,
        signature: await newSigner.signMessage(existingUser.discordId),
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.walletAddress).toBe(newSigner.address);
  });
});

async function createWalletForExistingUser() {
  await request(app.getHttpServer())
    .post("/users/me/wallets")
    .send({
      walletAddress: signer.address,
      signature: validSignatureForExistingUser,
      discordId: existingUser.discordId,
    })
    .set("Authorization", `Bearer ${validJwtForExistingUser}`);
}
