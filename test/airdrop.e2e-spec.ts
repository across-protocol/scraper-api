import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";

import { ValidationPipe } from "../src/validation.pipe";
import { AppModule } from "../src/app.module";
import { GetAirdropRewardsResponse } from "../src/modules/airdrop/entry-points/http/dto";
import { DepositFixture, mockDepositEntity } from "../src/modules/deposit/adapter/db/deposit-fixture";
import { Role } from "../src/modules/auth/entry-points/http/roles";
import { WalletRewardsFixture } from "../src/modules/airdrop/adapter/db/wallet-rewards-fixture";
import { CommunityRewardsFixture } from "../src/modules/airdrop/adapter/db/community-rewards-fixture";
import { UserFixture } from "../src/modules/user/adapter/db/user-fixture";
import { UserWalletFixture } from "../src/modules/user/adapter/db/user-wallet-fixture";
import { configValues } from "../src/modules/configuration";
import { TokenFixture } from "../src/modules/web3/adapters/db/token-fixture";
import { BigNumber } from "ethers";

let app: INestApplication;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule.forRoot()],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();
});

describe("GET /airdrop/rewards", () => {
  let walletRewardsFixture: WalletRewardsFixture;
  let communityRewardsFixture: CommunityRewardsFixture;
  let depositFixture: DepositFixture;
  let userFixture: UserFixture;
  let userWalletFixture: UserWalletFixture;
  let tokenFixture: TokenFixture;

  beforeAll(async () => {
    walletRewardsFixture = app.get(WalletRewardsFixture);
    communityRewardsFixture = app.get(CommunityRewardsFixture);
    depositFixture = app.get(DepositFixture);
    userFixture = app.get(UserFixture);
    userWalletFixture = app.get(UserWalletFixture);
    tokenFixture = app.get(TokenFixture);
  });

  beforeEach(async () => {
    await communityRewardsFixture.insertManyCommunityRewards([{ discordId: "1", amount: "100" }]);
    await walletRewardsFixture.insertManyWalletRewards([
      {
        walletAddress: "0x0000000000000000000000000000000000000001",
        earlyUserRewards: "1",
        liquidityProviderRewards: "0",
        welcomeTravellerRewards: "0",
      },
      {
        walletAddress: "0x0000000000000000000000000000000000000002",
        earlyUserRewards: "1",
        liquidityProviderRewards: "1",
        welcomeTravellerRewards: "1",
      },
    ]);
  });

  it("should not be elligible", async () => {
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .query({ address: "0x0000000000000000000000000000000000000003" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(false);
    expect(responseBody.earlyUserRewards.eligible).toEqual(false);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(false);
  });

  it("should be elligible for earlyUserRewards", async () => {
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .query({ address: "0x0000000000000000000000000000000000000001" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(false);
    expect(responseBody.earlyUserRewards.eligible).toEqual(true);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(false);
  });

  it("should be elligible for all rewards, but welcome traveller not completed", async () => {
    const user = await userFixture.insertUser({ discordId: "1" });
    const userJwt = app.get(JwtService).sign({ id: user.id }, { secret: configValues().auth.jwtSecret });
    await userWalletFixture.insertUserWallet({
      userId: user.id,
      walletAddress: "0x0000000000000000000000000000000000000002",
    });
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .set({ Authorization: `Bearer ${userJwt}` })
      .query({ address: "0x0000000000000000000000000000000000000002" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(true);
    expect(responseBody.earlyUserRewards.eligible).toEqual(true);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(true);
    expect(responseBody.welcomeTravellerRewards.completed).toEqual(false);
  });

  it("should be elligible for all rewards, but welcome traveller not completed due to lower amount", async () => {
    const user = await userFixture.insertUser({ discordId: "1" });
    const userJwt = app.get(JwtService).sign({ id: user.id }, { secret: configValues().auth.jwtSecret });
    const token = await tokenFixture.insertToken({ address: "0x1", symbol: "USDC" });
    await depositFixture.insertDeposit(
      mockDepositEntity({
        depositorAddr: "0x0000000000000000000000000000000000000002",
        status: "filled",
        tokenAddr: token.address,
        tokenId: token.id,
        amount: BigNumber.from(149).mul(token.decimals).toString(),
        depositDate: new Date("2022-11-20 00:00:00"),
      }),
    );
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .set({ Authorization: `Bearer ${userJwt}` })
      .query({ address: "0x0000000000000000000000000000000000000002" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(true);
    expect(responseBody.earlyUserRewards.eligible).toEqual(true);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(true);
    expect(responseBody.welcomeTravellerRewards.completed).toEqual(false);
  });

  it("should be elligible for all rewards, but welcome traveller not completed due to incorrect date", async () => {
    const user = await userFixture.insertUser({ discordId: "1" });
    const userJwt = app.get(JwtService).sign({ id: user.id }, { secret: configValues().auth.jwtSecret });
    const token = await tokenFixture.insertToken({ address: "0x1", symbol: "USDC" });
    await depositFixture.insertDeposit(
      mockDepositEntity({
        depositorAddr: "0x0000000000000000000000000000000000000002",
        status: "filled",
        tokenAddr: token.address,
        tokenId: token.id,
        amount: BigNumber.from(200).mul(token.decimals).toString(),
        depositDate: new Date("2022-11-23 00:00:00"),
      }),
    );
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .set({ Authorization: `Bearer ${userJwt}` })
      .query({ address: "0x0000000000000000000000000000000000000002" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(true);
    expect(responseBody.earlyUserRewards.eligible).toEqual(true);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(true);
    expect(responseBody.welcomeTravellerRewards.completed).toEqual(false);
  });

  it("should see traveller rewards as completed", async () => {
    const user = await userFixture.insertUser({ discordId: "1" });
    const userJwt = app.get(JwtService).sign({ id: user.id }, { secret: configValues().auth.jwtSecret });
    const token = await tokenFixture.insertToken({ address: "0x1", symbol: "USDC" });
    await depositFixture.insertDeposit(
      mockDepositEntity({
        depositorAddr: "0x0000000000000000000000000000000000000002",
        status: "filled",
        tokenAddr: token.address,
        tokenId: token.id,
        amount: BigNumber.from(150).mul(token.decimals).toString(),
        depositDate: new Date("2022-11-20 00:00:00"),
      }),
    );
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .set({ Authorization: `Bearer ${userJwt}` })
      .query({ address: "0x0000000000000000000000000000000000000002" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(true);
    expect(responseBody.earlyUserRewards.eligible).toEqual(true);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(true);
    expect(responseBody.welcomeTravellerRewards.completed).toEqual(true);
  });

  afterEach(async () => {
    await walletRewardsFixture.deleteAllWalletRewards();
    await communityRewardsFixture.deleteAllCommunityRewards();
    await depositFixture.deleteAllDeposits();
    await userFixture.deleteAllUsers();
    await userWalletFixture.deleteAllUserWallets();
    await tokenFixture.deleteAllTokens();
  });
});

describe("POST /airdrop/upload/rewards", () => {
  it("should not be authorized if token is not attached", async () => {
    const response = await request(app.getHttpServer()).post("/airdrop/upload/rewards");
    expect(response.statusCode).toStrictEqual(401);
  });

  it("should not be authorized if not admin", async () => {
    const userJwt = app.get(JwtService).sign({ roles: [Role.User] });
    const response = await request(app.getHttpServer())
      .post("/airdrop/upload/rewards")
      .set({ Authorization: `Bearer ${userJwt}` });
    expect(response.statusCode).toStrictEqual(403);
  });
});

afterAll(async () => {
  await app.close();
});
