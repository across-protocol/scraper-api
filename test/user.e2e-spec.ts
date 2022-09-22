import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Wallet, constants } from "ethers";

import { ValidationPipe } from "../src/validation.pipe";
import { AppModule } from "../src/app.module";
import { mockUserEntity } from "./fixtures/user";
import { generateJwtForUser } from "./utils";
import { UserService } from "../src/modules/user/services/user.service";
import { User } from "../src/modules/user/model/user.entity";
import { WalletService } from "../src/modules/user/services/wallet.service";

const signer = Wallet.createRandom();
const nonExistingUser = mockUserEntity();

let app: INestApplication;
let existingUser: User;
let validJwtForExistingUser: string;
let validSignatureForExistingUser: string;
let validSignatureForNonExistingUser: string;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  existingUser = await app.get(UserService).createUserFromDiscordId(
    mockUserEntity({
      discordId: Date.now().toString(),
    }),
  );
  validJwtForExistingUser = generateJwtForUser(existingUser);
  validSignatureForExistingUser = await signer.signMessage(existingUser.discordId);
  validSignatureForNonExistingUser = await signer.signMessage(nonExistingUser.discordId);
});

afterAll(async () => {
  await app.get(UserService).deleteUserById(existingUser.id);
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

describe("POST /users/wallets", () => {
  it("401 for unauthorized user", async () => {
    const response = await request(app.getHttpServer()).post("/users/wallets");
    expect(response.status).toBe(401);
  });

  it("400 for invalid body", async () => {
    const response = await request(app.getHttpServer())
      .post("/users/wallets")
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(400);
  });

  it("403 for invalid signature", async () => {
    const invalidSignature = await signer.signMessage("wrong message");
    const response = await request(app.getHttpServer())
      .post("/users/wallets")
      .send({
        walletAddress: signer.address,
        signature: invalidSignature,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(response.status).toBe(403);
  });

  it("404 for non-existent user", async () => {
    const jwtForNonExistentUser = generateJwtForUser(nonExistingUser);
    const response = await request(app.getHttpServer())
      .post("/users/wallets")
      .send({
        walletAddress: signer.address,
        signature: validSignatureForNonExistingUser,
        discordId: nonExistingUser.discordId,
      })
      .set("Authorization", `Bearer ${jwtForNonExistentUser}`);

    expect(response.status).toBe(404);
  });

  it("201 for valid body", async () => {
    const response = await request(app.getHttpServer())
      .post("/users/wallets")
      .send({
        walletAddress: signer.address,
        signature: validSignatureForExistingUser,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(response.status).toBe(201);
    expect(response.body.wallet.userId).toBe(existingUser.id);

    await app.get(WalletService).deleteWalletByUserId(existingUser.id);
  });
});

describe("PATCH /users/wallets", () => {
  it("401 for unauthorized user", async () => {
    const response = await request(app.getHttpServer()).patch("/users/wallets");
    expect(response.status).toBe(401);
  });

  it("400 for invalid body", async () => {
    const response = await request(app.getHttpServer())
      .patch("/users/wallets")
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);
    expect(response.status).toBe(400);
  });

  it("403 for invalid signature", async () => {
    const invalidSignature = await signer.signMessage("wrong message");
    const response = await request(app.getHttpServer())
      .patch("/users/wallets")
      .send({
        walletAddress: signer.address,
        signature: invalidSignature,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(response.status).toBe(403);
  });

  it("403 for invalid wallet address", async () => {
    const response = await request(app.getHttpServer())
      .patch("/users/wallets")
      .send({
        walletAddress: constants.AddressZero,
        signature: validSignatureForExistingUser,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(response.status).toBe(403);
  });

  it("404 for non-existent wallet", async () => {
    const response = await request(app.getHttpServer())
      .patch("/users/wallets")
      .send({
        walletAddress: signer.address,
        signature: validSignatureForNonExistingUser,
        discordId: nonExistingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(response.status).toBe(404);
  });

  it("200 for valid body", async () => {
    await request(app.getHttpServer())
      .post("/users/wallets")
      .send({
        walletAddress: signer.address,
        signature: validSignatureForExistingUser,
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    const newSigner = Wallet.createRandom();
    const patchResponse = await request(app.getHttpServer())
      .patch("/users/wallets")
      .send({
        walletAddress: newSigner.address,
        signature: await newSigner.signMessage(existingUser.discordId),
        discordId: existingUser.discordId,
      })
      .set("Authorization", `Bearer ${validJwtForExistingUser}`);

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.wallet.userId).toBe(existingUser.id);
    expect(patchResponse.body.wallet.walletAddress).toBe(newSigner.address);

    await app.get(WalletService).deleteWalletByUserId(existingUser.id);
  });
});
