import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";

import { ValidationPipe } from "../src/validation.pipe";
import { AppModule } from "../src/app.module";
import { GetAirdropRewardsResponse } from "../src/modules/airdrop/entry-points/http/dto";
import { DepositFixture, mockDepositEntity } from "../src/modules/scraper/adapter/db/deposit-fixture";
import { Role } from "../src/modules/auth/entry-points/http/roles";
import { WalletRewardsFixture } from "../src/modules/airdrop/adapter/db/wallet-rewards-fixture";
import { CommunityRewardsFixture } from "../src/modules/airdrop/adapter/db/community-rewards-fixture";
import { UserFixture } from "../src/modules/user/adapter/db/user-fixture";
import { UserWalletFixture } from "../src/modules/user/adapter/db/user-wallet-fixture";

let app: INestApplication;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
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

  beforeAll(async () => {
    walletRewardsFixture = app.get(WalletRewardsFixture);
    communityRewardsFixture = app.get(CommunityRewardsFixture);
    depositFixture = app.get(DepositFixture);
    userFixture = app.get(UserFixture);
    userWalletFixture = app.get(UserWalletFixture);

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
    await userWalletFixture.insertUserWallet({
      userId: user.id,
      walletAddress: "0x0000000000000000000000000000000000000002",
    });
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .query({ address: "0x0000000000000000000000000000000000000002" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(true);
    expect(responseBody.earlyUserRewards.eligible).toEqual(true);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(true);
    expect(responseBody.welcomeTravellerRewards.completed).toEqual(false);
  });

  it("should see traveller rewards as completed", async () => {
    await depositFixture.insertDeposit(
      mockDepositEntity({ depositorAddr: "0x0000000000000000000000000000000000000002", status: "filled" }),
    );
    const response = await request(app.getHttpServer())
      .get("/airdrop/rewards")
      .query({ address: "0x0000000000000000000000000000000000000002" });
    const responseBody = response.body as GetAirdropRewardsResponse;
    expect(response.status).toBe(200);
    expect(responseBody.communityRewards.eligible).toEqual(true);
    expect(responseBody.earlyUserRewards.eligible).toEqual(true);
    expect(responseBody.liquidityProviderRewards.eligible).toEqual(true);
    expect(responseBody.welcomeTravellerRewards.completed).toEqual(true);
  });

  afterAll(async () => {
    await walletRewardsFixture.deleteAllWalletRewards();
    await communityRewardsFixture.deleteAllCommunityRewards();
    await depositFixture.deleteAllDeposits();
    await userFixture.deleteAllUsers();
    await userWalletFixture.deleteAllUserWallets();
  });
});

describe("POST /airdrop/upload/rewards", () => {
  beforeAll(async () => {});

  it("should not be authorized if token is not attached", async () => {
    const response = await request(app.getHttpServer()).post("/airdrop/upload/rewards");
    expect(response.statusCode).toStrictEqual(401);
  });

  it("should not be authorized if not admin", async () => {
    const userJwt = app.get(JwtService).sign({ roles: [Role.User] });
    console.log({ userJwt });
    const response = await request(app.getHttpServer())
      .post("/airdrop/upload/rewards")
      .set({ Authorization: `Bearer ${userJwt}` });
    expect(response.statusCode).toStrictEqual(403);
  });

  afterAll(async () => {});
});

afterAll(async () => {
  await app.close();
});
