import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ethers } from "ethers";
import { readFile } from "fs/promises";
import BigNumber from "bignumber.js";
import { DataSource, IsNull, Not, QueryFailedError, Repository } from "typeorm";

import { Deposit } from "../../scraper/model/deposit.entity";
import { CommunityRewards } from "../model/community-rewards.entity";
import { WalletRewards } from "../model/wallet-rewards.entity";
import { Token } from "../../web3/model/token.entity";

import { UserService } from "../../user/services/user.service";
import {
  DuplicatedMerkleDistributorWindowException,
  ProcessCommunityRewardsFileException,
  ProcessWalletRewardsFileException,
} from "./exceptions";
import { EditWalletRewardsBody } from "../entry-points/http/dto";
import { AppConfig } from "../../configuration/configuration.service";
import { MerkleDistributorWindow } from "../model/merkle-distributor-window.entity";
import { MerkleDistributorRecipient } from "../model/merkle-distributor-recipient.entity";
import { UserWallet } from "../../user/model/user-wallet.entity";

@Injectable()
export class AirdropService {
  private logger = new Logger(AirdropService.name);

  constructor(
    @InjectRepository(CommunityRewards) private communityRewardsRepository: Repository<CommunityRewards>,
    @InjectRepository(WalletRewards) private walletRewardsRepository: Repository<WalletRewards>,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(Deposit) private merkleDistributorWindowRepository: Repository<MerkleDistributorWindow>,
    @InjectRepository(Deposit) private merkleDistributorRecipientRepository: Repository<MerkleDistributorRecipient>,
    private userService: UserService,
    private appConfig: AppConfig,
    private dataSource: DataSource,
  ) {}

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
      const depositCountQuery = await this.depositRepository
        .createQueryBuilder("deposit")
        .innerJoin(Token, "token", "deposit.tokenId = token.id")
        .where("deposit.depositorAddr = :depositorAddr", { depositorAddr: checksumAddress })
        .andWhere(
          "((token.symbol = 'USDC' and deposit.amount / token.decimals >= :usdAmount) or (token.symbol = 'WETH' and deposit.amount / token.decimals >= :wethAmount))",
          { usdAmount: 150, wethAmount: 0.1 },
        );
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
        error instanceof QueryFailedError &&
        (error as QueryFailedError).driverError.constraint === "UK_merkle_distributor_window_windowIndex"
      ) {
        throw new DuplicatedMerkleDistributorWindowException();
      }

      throw error;
    }
  }

  public async getMerkleDistributorProof(address: string, windowIndex: number, includeDiscord: boolean) {
    const checksumAddress = ethers.utils.getAddress(address);

    const query = this.dataSource
      .createQueryBuilder(MerkleDistributorRecipient, "recipient")
      .innerJoinAndSelect("recipient.merkleDistributorWindow", "window")
      .where("recipient.address = :address", { address: checksumAddress })
      .andWhere("window.windowIndex = :windowIndex", { windowIndex });
    const recipient = await query.getOne();

    if (!recipient) return {};

    let userWallet: UserWallet | undefined;

    if (includeDiscord) {
      userWallet = await this.dataSource
        .createQueryBuilder(UserWallet, "userWallet")
        .innerJoinAndSelect("userWallet.user", "user")
        .where("userWallet.walletAddress = :address", { address })
        .getOne();
    }

    return {
      accountIndex: recipient.accountIndex,
      address: recipient.address,
      amount: recipient.amount,
      payload: recipient.payload,
      proof: recipient.proof,
      merkleRoot: recipient.merkleDistributorWindow.merkleRoot,
      windowIndex: recipient.merkleDistributorWindow.windowIndex,
      ipfsHash: recipient.merkleDistributorWindow.ipfsHash || null,
      discord: userWallet
        ? {
            discordId: userWallet.user.discordId,
            discordName: userWallet.user.discordName,
            discordAvatar: userWallet.user.discordAvatar,
          }
        : null,
    };
  }

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
    communityRewards.amount = new BigNumber(amount).multipliedBy(wei).toString();
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
    walletRewards.earlyUserRewards = new BigNumber(earlyUserRewards).multipliedBy(wei).toString();
    walletRewards.liquidityProviderRewards = new BigNumber(liquidityProviderRewards).multipliedBy(wei).toString();
    walletRewards.welcomeTravellerRewards = new BigNumber(welcomeTravellerRewards).multipliedBy(wei).toString();
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
