import { BadRequestException, CACHE_MANAGER, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ethers } from "ethers";
import { readFile } from "fs/promises";
import BigNumber from "bignumber.js";
import { DataSource, IsNull, Not, QueryFailedError, Repository } from "typeorm";
import { Cache } from "cache-manager";

import { Deposit } from "../../deposit/model/deposit.entity";
import { CommunityRewards } from "../model/community-rewards.entity";
import { WalletRewards } from "../model/wallet-rewards.entity";
import { Token } from "../../web3/model/token.entity";

import { UserService } from "../../user/services/user.service";
import {
  DuplicatedMerkleDistributorWindowException,
  ProcessCommunityRewardsFileException,
  ProcessWalletRewardsFileException,
} from "./exceptions";
import {
  EditWalletRewardsBody,
  GetEtlMerkleDistributorRecipientsQuery,
  GetMerkleDistributorProofQuery,
  GetMerkleDistributorProofsQuery,
} from "../entry-points/http/dto";
import { AppConfig } from "../../configuration/configuration.service";
import { MerkleDistributorWindow } from "../model/merkle-distributor-window.entity";
import { MerkleDistributorRecipient } from "../model/merkle-distributor-recipient.entity";
import { UserWallet } from "../../user/model/user-wallet.entity";
import { RewardsType } from "../../rewards/model/RewardsWindowJob.entity";

const getMerkleDistributorProofCacheKey = (address: string, windowIndex: number, rewardsType: string) =>
  `distributor:proof:${rewardsType}:${address}:${windowIndex}`;
const getMerkleDistributorProofsCacheKey = (address: string, startWindowIndex: number, rewardsType: string) =>
  `distributor:proofs:${rewardsType}:${address}:${startWindowIndex}`;

@Injectable()
export class AirdropService {
  private logger = new Logger(AirdropService.name);

  constructor(
    @InjectRepository(CommunityRewards) private communityRewardsRepository: Repository<CommunityRewards>,
    @InjectRepository(WalletRewards) private walletRewardsRepository: Repository<WalletRewards>,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private userService: UserService,
    private appConfig: AppConfig,
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  public async getWelcomeTravellerEligibleWallets() {
    const addresses = await this.dataSource
      .createQueryBuilder(Deposit, "d")
      .innerJoin(Token, "t", "t.id = d.tokenId")
      .innerJoin(WalletRewards, "wr", "wr.walletAddress = d.depositorAddr")
      .select("distinct d.depositorAddr")
      .where(
        "((t.symbol = 'USDC' and d.amount / t.decimals >= :usdAmount) or (t.symbol = 'WETH' and d.amount / t.decimals >= :wethAmount))",
        { usdAmount: 150, wethAmount: 0.1 },
      )
      .andWhere("wr.welcomeTravellerRewards > 0")
      .andWhere("d.depositDate < '2022-11-22 00:00'")
      .getRawMany();

    return {
      total: addresses.length,
      addresses: addresses.map((a) => a.depositorAddr),
    };
  }

  public async getCommunityRewardsEligibleWallets() {
    const [userWallets, total] = await this.dataSource
      .createQueryBuilder(UserWallet, "uw")
      .innerJoinAndSelect("uw.user", "u")
      .innerJoin(CommunityRewards, "cr", "cr.discordId = u.discordId")
      .getManyAndCount();

    return {
      total,
      addresses: userWallets.map((uw) => ({ walletAddress: uw.walletAddress, discordId: uw.user.discordId })),
    };
  }

  public async editWalletRewards(params: EditWalletRewardsBody) {
    if (!this.appConfig.values.allowWalletRewardsEdit) throw new BadRequestException();

    const { earlyUserRewards, liquidityProviderRewards, walletAddress, welcomeTravellerRewards } = params;
    const address = ethers.utils.getAddress(walletAddress);
    await this.walletRewardsRepository.upsert(
      {
        walletAddress: address,
        earlyUserRewards,
        liquidityProviderRewards,
        welcomeTravellerRewards,
      },
      {
        conflictPaths: ["walletAddress"],
        skipUpdateIfNoValuesChanged: true, // supported by postgres, skips update if it would not change row values
      },
    );

    return { status: "ok" };
  }

  public async getRewards(walletAddress: string, userId?: number) {
    const checksumAddress = ethers.utils.getAddress(walletAddress);
    const walletRewards = await this.getWalletRewards(checksumAddress);
    let communityRewards = undefined;

    if (userId) {
      communityRewards = await this.getCommunityRewards(userId);
    }

    const welcomeTravellerEligible = !!walletRewards && new BigNumber(walletRewards.welcomeTravellerRewards).gt(0);
    let welcomeTravellerCompleted = false;

    if (welcomeTravellerEligible) {
      const depositCountQuery = this.depositRepository
        .createQueryBuilder("deposit")
        .innerJoin(Token, "token", "deposit.tokenId = token.id")
        .where("deposit.depositorAddr = :depositorAddr", { depositorAddr: checksumAddress })
        .andWhere(
          "((token.symbol = 'USDC' and deposit.amount / token.decimals >= :usdAmount) or (token.symbol = 'WETH' and deposit.amount / token.decimals >= :wethAmount))",
          { usdAmount: 150, wethAmount: 0.1 },
        )
        .andWhere("deposit.depositDate < '2022-11-22 00:00'");
      const depositCount = await depositCountQuery.getCount();

      if (depositCount > 0) {
        welcomeTravellerCompleted = true;
      }
    }

    return {
      welcomeTravellerRewards: {
        eligible: welcomeTravellerEligible,
        completed: welcomeTravellerCompleted,
        amount: walletRewards?.welcomeTravellerRewards || "0",
      },
      earlyUserRewards: {
        eligible: !!walletRewards && new BigNumber(walletRewards.earlyUserRewards).gt(0),
        amount: walletRewards?.earlyUserRewards || "0",
      },
      liquidityProviderRewards: {
        eligible: !!walletRewards && new BigNumber(walletRewards.liquidityProviderRewards).gt(0),
        amount: walletRewards?.liquidityProviderRewards || "0",
      },
      communityRewards: {
        eligible: communityRewards ? new BigNumber(communityRewards).gt(0) : false,
        amount: communityRewards || "0",
      },
    };
  }

  async processUploadedRewardsFiles({
    walletRewardsFile,
    communityRewardsFile,
  }: {
    walletRewardsFile?: Express.Multer.File;
    communityRewardsFile?: Express.Multer.File;
  }) {
    if (communityRewardsFile) {
      await this.processCommunityRewardsFile(communityRewardsFile);
    }

    if (walletRewardsFile) {
      await this.processWalletRewardsFile(walletRewardsFile);
    }

    const [communityRewardsCount, walletRewardsCount] = await Promise.all([
      this.communityRewardsRepository.count(),
      this.walletRewardsRepository.count(),
    ]);

    return {
      communityRewardsCount,
      walletRewardsCount,
    };
  }

  async processMerkleDistributorRecipientsFile(file?: Express.Multer.File) {
    if (!file) return;

    const recipientsFile = await readFile(file.path, { encoding: "utf8" });
    const recipientsJson = JSON.parse(recipientsFile);

    try {
      return await this.dataSource.transaction(async (entityManager) => {
        const window = await entityManager
          .createQueryBuilder()
          .insert()
          .into(MerkleDistributorWindow)
          .values({
            contractAddress: recipientsJson["contractAddress"],
            chainId: recipientsJson["chainId"],
            rewardToken: recipientsJson["rewardToken"],
            windowIndex: recipientsJson["windowIndex"],
            rewardsToDeposit: recipientsJson["rewardsToDeposit"],
            merkleRoot: recipientsJson["merkleRoot"],
            ipfsHash: recipientsJson["ipfsHash"],
          })
          .execute();
        const windowId = window.identifiers[0].id;

        for (const recipient of Object.values(recipientsJson["recipientsWithProofs"])) {
          await entityManager
            .createQueryBuilder()
            .insert()
            .into(MerkleDistributorRecipient)
            .values({
              merkleDistributorWindowId: windowId,
              address: ethers.utils.getAddress(recipient["account"]),
              amount: recipient["amount"],
              accountIndex: recipient["accountIndex"],
              proof: recipient["proof"],
              payload: recipient["metadata"],
            })
            .execute();
        }

        const query = entityManager
          .createQueryBuilder(MerkleDistributorRecipient, "recipient")
          .select("COUNT(*) as count")
          .where("recipient.merkleDistributorWindowId = :windowId", { windowId });
        const recipientsCount = await query.getRawOne();

        return {
          recipients: isNaN(parseInt(recipientsCount.count)) ? null : parseInt(recipientsCount.count),
        };
      });
    } catch (error) {
      if (
        (error instanceof QueryFailedError &&
          (error as QueryFailedError).driverError.constraint === "UK_merkle_distributor_window_windowIndex") ||
        (error instanceof QueryFailedError &&
          (error as QueryFailedError).driverError.constraint === "UK_mdw_chainId_contractAddress_windowIndex")
      ) {
        throw new DuplicatedMerkleDistributorWindowException();
      }

      throw error;
    }
  }

  public async getMerkleDistributorProof(query: GetMerkleDistributorProofQuery) {
    const { address, windowIndex, rewardsType } = query;;
    let contractAddress: string | undefined = undefined;

    if (rewardsType === RewardsType.ReferralRewards) {
      contractAddress = this.appConfig.values.web3.merkleDistributor.address;
    } else if (rewardsType === RewardsType.OpRewards) {
      contractAddress = this.appConfig.values.web3.merkleDistributorContracts.opRewards.address;
    } else if (rewardsType === RewardsType.ArbRewards) {
      contractAddress = this.appConfig.values.web3.merkleDistributorContracts.arbRewards.address;
    }

    const checksumAddress = ethers.utils.getAddress(address);
    const cacheKey = getMerkleDistributorProofCacheKey(checksumAddress, windowIndex, rewardsType);
    let data = await this.cacheManager.get(cacheKey);

    if (data) return data;

    const dbQuery = this.dataSource
      .createQueryBuilder(MerkleDistributorRecipient, "recipient")
      .innerJoinAndSelect("recipient.merkleDistributorWindow", "window")
      .where("recipient.address = :address", { address: checksumAddress })
      .andWhere("window.windowIndex = :windowIndex", { windowIndex })
      .andWhere("window.contractAddress = :contractAddress", { contractAddress });

    const recipient = await dbQuery.getOne();
    if (!recipient) return {};

    data = {
      accountIndex: recipient.accountIndex,
      address: recipient.address,
      amount: recipient.amount,
      payload: recipient.payload,
      proof: recipient.proof,
      merkleRoot: recipient.merkleDistributorWindow.merkleRoot,
      windowIndex: recipient.merkleDistributorWindow.windowIndex,
      ipfsHash: recipient.merkleDistributorWindow.ipfsHash || null,
    };

    await this.cacheManager.set(cacheKey, data, this.appConfig.values.app.cacheDuration.distributorProofs);
    return data;
  }

  public async getMerkleDistributorProofs(query: GetMerkleDistributorProofsQuery) {
    const { address } = query;
    const startWindowIndex = query.startWindowIndex || 0;
    const rewardsType = query.rewardsType;
    const checksumAddress = ethers.utils.getAddress(address);

    let contractAddress: string | undefined = undefined;

    if (rewardsType === RewardsType.ReferralRewards) {
      contractAddress = this.appConfig.values.web3.merkleDistributor.address;
    } else if (rewardsType === RewardsType.OpRewards) {
      contractAddress = this.appConfig.values.web3.merkleDistributorContracts.opRewards.address;
    } else if (rewardsType === RewardsType.ArbRewards) {
      contractAddress = this.appConfig.values.web3.merkleDistributorContracts.arbRewards.address;
    }

    const cacheKey = getMerkleDistributorProofsCacheKey(checksumAddress, startWindowIndex, rewardsType);
    let data = await this.cacheManager.get(cacheKey);

    if (data) return data;

    const dbQuery = this.dataSource
      .createQueryBuilder(MerkleDistributorRecipient, "recipient")
      .innerJoinAndSelect("recipient.merkleDistributorWindow", "window")
      .where("recipient.address = :address", { address: checksumAddress })
      .andWhere("window.windowIndex >= :startWindowIndex", { startWindowIndex })
      .andWhere("window.contractAddress = :contractAddress", { contractAddress });
    const recipients = await dbQuery.getMany();

    if (!recipients) return [];

    data = recipients.map((recipient) => ({
      accountIndex: recipient.accountIndex,
      address: recipient.address,
      amount: recipient.amount,
      payload: recipient.payload,
      proof: recipient.proof,
      merkleRoot: recipient.merkleDistributorWindow.merkleRoot,
      windowIndex: recipient.merkleDistributorWindow.windowIndex,
      ipfsHash: recipient.merkleDistributorWindow.ipfsHash || null,
    }));

    if (this.appConfig.values.app.cacheDuration.distributorProofs) {
      await this.cacheManager.set(cacheKey, data, this.appConfig.values.app.cacheDuration.distributorProofs);
    }
    return data;
  }

  public async getEtlMerkleDistributorRecipients(queryParams: GetEtlMerkleDistributorRecipientsQuery) {
    const sqlQery = this.dataSource
      .createQueryBuilder(MerkleDistributorRecipient, "recipient")
      .innerJoinAndSelect("recipient.merkleDistributorWindow", "window")
      .andWhere("window.windowIndex = :windowIndex", { windowIndex: queryParams.windowIndex });
    const recipients = await sqlQery.getMany();

    return recipients.map((recipient) => ({
      window_index: recipient.merkleDistributorWindow.windowIndex,
      address: recipient.address,
      bridge_traveler: recipient.payload.amountBreakdown.welcomeTravelerRewards,
      bridgoor: recipient.payload.amountBreakdown.earlyUserRewards,
      community: recipient.payload.amountBreakdown.communityRewards,
      lp: recipient.payload.amountBreakdown.liquidityProviderRewards,
      total: recipient.amount,
      referral_rewards_amount: recipient.payload.amountBreakdown.referralRewards,
    }));
  }

  ////////////////////////////////////
  ////       PRIVATE METHODS      ////
  ////////////////////////////////////

  private async processWalletRewardsFile(walletRewardsFile: Express.Multer.File) {
    try {
      await this.walletRewardsRepository.update({ id: Not(IsNull()) }, { processed: false });
      const walletRewardsContent = await readFile(walletRewardsFile.path, { encoding: "utf8" });
      const walletRewards = JSON.parse(walletRewardsContent);

      for (const walletAddress of Object.keys(walletRewards)) {
        await this.insertWalletRewards({
          walletAddress: ethers.utils.getAddress(walletAddress),
          earlyUserRewards: walletRewards[walletAddress]["bridgoor"] || 0,
          liquidityProviderRewards: walletRewards[walletAddress]["lp"] || 0,
          welcomeTravellerRewards: walletRewards[walletAddress]["bridge-traveler"] || 0,
        });
      }
      await this.walletRewardsRepository.delete({ processed: false });
    } catch (error) {
      this.logger.error(error);
      await this.walletRewardsRepository.update({ id: Not(IsNull()) }, { processed: true });
      throw new ProcessWalletRewardsFileException();
    }
  }

  private async processCommunityRewardsFile(communityRewardsFile: Express.Multer.File) {
    try {
      await this.communityRewardsRepository.update({ id: Not(IsNull()) }, { processed: false });

      const communityRewardsContent = await readFile(communityRewardsFile.path, { encoding: "utf8" });
      const communityRewards = JSON.parse(communityRewardsContent);

      for (const communityReward of communityRewards) {
        if (communityReward["ID"] && communityReward["Total Tokens"]) {
          await this.insertCommunityRewards(communityReward["ID"], communityReward["Total Tokens"]);
        }
      }
      await this.communityRewardsRepository.delete({ processed: false });
    } catch (error) {
      this.logger.error(error);
      await this.communityRewardsRepository.update({ id: Not(IsNull()) }, { processed: true });
      throw new ProcessCommunityRewardsFileException();
    }
  }

  private async insertCommunityRewards(discordId: string, amount: number) {
    let communityRewards = await this.communityRewardsRepository.findOne({ where: { discordId } });

    if (!communityRewards) {
      communityRewards = this.communityRewardsRepository.create();
    }

    const wei = new BigNumber(10).pow(18);
    communityRewards.amount = new BigNumber(amount).multipliedBy(wei).toFixed();
    communityRewards.discordId = discordId;
    communityRewards.processed = true;

    await this.communityRewardsRepository.save(communityRewards);
  }

  private async insertWalletRewards({
    earlyUserRewards,
    liquidityProviderRewards,
    walletAddress,
    welcomeTravellerRewards,
  }: {
    walletAddress: string;
    earlyUserRewards: number;
    liquidityProviderRewards: number;
    welcomeTravellerRewards: number;
  }) {
    let walletRewards = await this.walletRewardsRepository.findOne({ where: { walletAddress } });

    if (!walletRewards) {
      walletRewards = this.walletRewardsRepository.create();
    }

    const wei = new BigNumber(10).pow(18);
    walletRewards.earlyUserRewards = new BigNumber(earlyUserRewards).multipliedBy(wei).toFixed();
    walletRewards.liquidityProviderRewards = new BigNumber(liquidityProviderRewards).multipliedBy(wei).toFixed();
    walletRewards.welcomeTravellerRewards = new BigNumber(welcomeTravellerRewards).multipliedBy(wei).toFixed();
    walletRewards.walletAddress = walletAddress;
    walletRewards.processed = true;

    await this.walletRewardsRepository.save(walletRewards);
  }

  private async getWalletRewards(walletAddress: string) {
    return this.walletRewardsRepository.findOne({ where: { walletAddress } });
  }

  private async getCommunityRewards(userId: number): Promise<string | undefined> {
    const user = await this.userService.getUserByAttributes({ id: userId });

    if (!user) {
      return undefined;
    }

    const communityRewards = await this.communityRewardsRepository.findOne({ where: { discordId: user.discordId } });

    if (!communityRewards) {
      return undefined;
    }

    return communityRewards.amount;
  }
}
