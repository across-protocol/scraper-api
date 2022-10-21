import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Role } from "../../src/modules/auth/entry-points/http/roles";
import { configValues } from "../../src/modules/configuration";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { ValidationPipe } from "../../src/validation.pipe";
import { MerkleDistributorWindowFixture } from "../../src/modules/airdrop/adapter/db/merkle-distributor-window-fixture";
import { MerkleDistributorRecipientFixture } from "../../src/modules/airdrop/adapter/db/merkle-distributor-recipient";
import { UserFixture } from "../../src/modules/user/adapter/db/user-fixture";
import { UserWalletFixture } from "../../src/modules/user/adapter/db/user-wallet-fixture";

let app: INestApplication;
let merkleDistributorWindowFixture: MerkleDistributorWindowFixture;
let merkleDistributorRecipientFixture: MerkleDistributorRecipientFixture;
let userFixture: UserFixture;
let userWalletFixture: UserWalletFixture;

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  merkleDistributorWindowFixture = app.get(MerkleDistributorWindowFixture);
  merkleDistributorRecipientFixture = app.get(MerkleDistributorRecipientFixture);
  userFixture = app.get(UserFixture);
  userWalletFixture = app.get(UserWalletFixture);
});

describe("GET /airdrop/merkle-distributor-proof", () => {
  const url = "/airdrop/merkle-distributor-proof";

  afterEach(async () => {
    await merkleDistributorWindowFixture.deleteAllMerkleDistributorWindows();
    await merkleDistributorRecipientFixture.deleteAllMerkleDistributorRecipients();
    await userFixture.deleteAllUsers();
    await userWalletFixture.deleteAllUserWallets();
  });

  it("should get the merkle proof", async () => {
    const address = "0x00B591BC2b682a0B30dd72Bac9406BfA13e5d3cd";
    const window = await merkleDistributorWindowFixture.insertMerkleDistributorWindow({
      merkleRoot: "0xmerkleroot",
      windowIndex: 0,
      rewardToken: "0xrewardtoken",
      rewardsToDeposit: "10",
    });
    await merkleDistributorRecipientFixture.insertMerkleDistributorRecipient({
      accountIndex: 0,
      address,
      amount: "10",
      merkleDistributorWindowId: window.id,
      proof: ["0xproof"],
      payload: {
        amountBreakdown: {
          communityRewards: "2",
          earlyUserRewards: "2",
          liquidityProviderRewards: "2",
          welcomeTravelerRewards: "4",
        },
      },
    });
    const response = await request(app.getHttpServer()).get(url).query({
      address,
      windowIndex: 0,
    });
    expect(response.statusCode).toStrictEqual(200);
    expect(response.body.address).toStrictEqual(address);
    expect(response.body.windowIndex).toStrictEqual(0);
    expect(response.body.discord).toStrictEqual(null);
  });

  it("should get the merkle proof and discord details", async () => {
    const address = "0x00B591BC2b682a0B30dd72Bac9406BfA13e5d3cd";
    const user = await userFixture.insertUser({
      discordAvatar: "https://discord.avatar",
      discordId: "discordId",
      discordName: "discordName",
    });
    await userWalletFixture.insertUserWallet({ userId: user.id, walletAddress: address });
    const window = await merkleDistributorWindowFixture.insertMerkleDistributorWindow({
      merkleRoot: "0xmerkleroot",
      windowIndex: 0,
      rewardToken: "0xrewardtoken",
      rewardsToDeposit: "10",
    });
    await merkleDistributorRecipientFixture.insertMerkleDistributorRecipient({
      accountIndex: 0,
      address,
      amount: "10",
      merkleDistributorWindowId: window.id,
      proof: ["0xproof"],
      payload: {
        amountBreakdown: {
          communityRewards: "2",
          earlyUserRewards: "2",
          liquidityProviderRewards: "2",
          welcomeTravelerRewards: "4",
        },
      },
    });
    const response = await request(app.getHttpServer()).get(url).query({
      address,
      windowIndex: 0,
      includeDiscord: true,
    });
    expect(response.statusCode).toStrictEqual(200);
    expect(response.body.address).toStrictEqual(address);
    expect(response.body.windowIndex).toStrictEqual(0);
    expect(response.body.discord).toStrictEqual({
      discordAvatar: "https://discord.avatar",
      discordId: "discordId",
      discordName: "discordName",
    });
  });

  it("should return empty if window index is incorrect", async () => {
    const address = "0x00B591BC2b682a0B30dd72Bac9406BfA13e5d3cd";
    const window = await merkleDistributorWindowFixture.insertMerkleDistributorWindow({
      merkleRoot: "0xmerkleroot",
      windowIndex: 0,
      rewardToken: "0xrewardtoken",
      rewardsToDeposit: "10",
    });
    await merkleDistributorRecipientFixture.insertMerkleDistributorRecipient({
      accountIndex: 0,
      address,
      amount: "10",
      merkleDistributorWindowId: window.id,
      proof: ["0xproof"],
      payload: {
        amountBreakdown: {
          communityRewards: "2",
          earlyUserRewards: "2",
          liquidityProviderRewards: "2",
          welcomeTravelerRewards: "4",
        },
      },
    });
    const response = await request(app.getHttpServer()).get(url).query({
      address,
      windowIndex: 1,
    });
    expect(response.statusCode).toStrictEqual(200);
    expect(response.body).toStrictEqual({});
  });

  it("should return empty if account is incorrect", async () => {
    const address = "0x00B591BC2b682a0B30dd72Bac9406BfA13e5d3cd";
    const window = await merkleDistributorWindowFixture.insertMerkleDistributorWindow({
      merkleRoot: "0xmerkleroot",
      windowIndex: 0,
      rewardToken: "0xrewardtoken",
      rewardsToDeposit: "10",
    });
    await merkleDistributorRecipientFixture.insertMerkleDistributorRecipient({
      accountIndex: 0,
      address,
      amount: "10",
      merkleDistributorWindowId: window.id,
      proof: ["0xproof"],
      payload: {
        amountBreakdown: {
          communityRewards: "2",
          earlyUserRewards: "2",
          liquidityProviderRewards: "2",
          welcomeTravelerRewards: "4",
        },
      },
    });
    const response = await request(app.getHttpServer()).get(url).query({
      address: "0x717DCF5FEF335c8f0A9b864859EF0734dFe3D2c3",
      windowIndex: 0,
    });
    expect(response.statusCode).toStrictEqual(200);
    expect(response.body).toStrictEqual({});
  });
});

describe("POST /airdrop/upload/merkle-distributor-recipients", () => {
  const url = "/airdrop/upload/merkle-distributor-recipients";

  afterEach(async () => {
    await merkleDistributorWindowFixture.deleteAllMerkleDistributorWindows();
    await merkleDistributorRecipientFixture.deleteAllMerkleDistributorRecipients();
  });

  it("should not be authorized if JWT is not attached", async () => {
    const response = await request(app.getHttpServer()).post(url);
    expect(response.statusCode).toStrictEqual(401);
  });

  it("should error if JWT doesn't have admin role", async () => {
    const userJwt = app.get(JwtService).sign({ roles: [Role.User] }, { secret: configValues().auth.jwtSecret });
    const response = await request(app.getHttpServer())
      .post(url)
      .set({ Authorization: `Bearer ${userJwt}` });
    expect(response.statusCode).toStrictEqual(403);
  });

  it("should error for duplicated windows", async () => {
    const jwt = app.get(JwtService).sign({ roles: [Role.Admin] }, { secret: configValues().auth.jwtSecret });
    let response = await request(app.getHttpServer())
      .post(url)
      .attach("file", __dirname + "/merkle-distributor-duplicate-window.json")
      .set({ Authorization: `Bearer ${jwt}` });
    expect(response.statusCode).toStrictEqual(201);
    response = await request(app.getHttpServer())
      .post(url)
      .attach("file", __dirname + "/merkle-distributor-duplicate-window.json")
      .set({ Authorization: `Bearer ${jwt}` });
    expect(response.statusCode).toStrictEqual(400);
    expect(response.body.error).toStrictEqual("DuplicatedMerkleDistributorWindowException");
  });

  it("should work successfully", async () => {
    const jwt = app.get(JwtService).sign({ roles: [Role.Admin] }, { secret: configValues().auth.jwtSecret });
    const response = await request(app.getHttpServer())
      .post(url)
      .attach("file", __dirname + "/merkle-distributor.json")
      .set({ Authorization: `Bearer ${jwt}` });
    expect(response.statusCode).toStrictEqual(201);
    expect(response.body.recipients).toStrictEqual(2);
  });
});

afterAll(async () => {
  await app.close();
});
