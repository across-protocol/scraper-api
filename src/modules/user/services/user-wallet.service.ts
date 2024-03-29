import { Injectable, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import { utils } from "ethers";

import { UserWallet } from "../model/user-wallet.entity";
import {
  InvalidSignatureException,
  WalletNotFoundException,
  WalletAlreadyLinkedException,
  UserWalletNotFoundException,
} from "./exceptions";
import { UserService } from "./user.service";

@Injectable()
export class UserWalletService {
  constructor(
    @InjectRepository(UserWallet) private userWalletRepository: Repository<UserWallet>,
    @Inject(UserService) private userService: UserService,
  ) {}

  public async getWalletByUserId(userId: number) {
    const userWallet = await this.userWalletRepository.findOne({ where: { userId } });

    if (!userWallet) {
      throw new WalletNotFoundException(userId);
    }

    return userWallet;
  }

  public async linkWallet({
    userId,
    walletAddress,
    signature,
    discordId,
  }: {
    userId: number;
    walletAddress: string;
    signature: string;
    discordId: string;
  }) {
    const wallet = await this.userWalletRepository.findOne({
      where: { walletAddress },
    });

    if (wallet) {
      if (wallet.userId === userId) {
        return wallet;
      } else {
        throw new WalletAlreadyLinkedException();
      }
    }

    this.verifySignedDiscordId({
      signature,
      discordIdMessage: discordId,
      walletAddress,
    });

    await this.assertUserExists(userId);

    const upsertResult = await this.userWalletRepository.upsert(
      {
        userId,
        walletAddress,
      },
      {
        conflictPaths: ["userId"],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    return {
      id: upsertResult.identifiers[0].id,
      walletAddress,
      userId,
      discordId,
    };
  }

  public async updateLinkedWallet({
    userId,
    walletAddress,
    signature,
    discordId,
  }: {
    userId: number;
    walletAddress: string;
    signature: string;
    discordId: string;
  }) {
    return this.linkWallet({ userId, walletAddress, signature, discordId });
  }

  public verifySignedDiscordId({
    signature,
    discordIdMessage,
    walletAddress,
  }: {
    signature: string;
    discordIdMessage: string;
    walletAddress: string;
  }) {
    const recoveredAddress = utils.verifyMessage(discordIdMessage, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new InvalidSignatureException();
    }
  }

  public async deleteWalletByUserId(userId: number) {
    return this.userWalletRepository.delete({
      userId,
    });
  }

  public async assertUserExists(userId: number) {
    await this.userService.getUserByAttributes({ id: userId }, true);
  }

  public async getUserWalletByAttributes(
    where: FindOptionsWhere<UserWallet>,
    validate = false,
    select?: (keyof UserWallet)[],
  ) {
    const user = await this.userWalletRepository.findOne({ where, select });

    if (!user && validate) {
      throw new UserWalletNotFoundException();
    }

    return user;
  }

  public async getEtlDiscordUsersWallet() {
    const query = this.userWalletRepository
      .createQueryBuilder("uw")
      .leftJoinAndSelect("uw.user", "u")
      .select(["uw.walletAddress", "u.discordId"]);
    const userWallets = await query.getMany();
    return userWallets.map((uw) => ({
      address: uw.walletAddress,
      discord_id: uw.user.discordId,
    }));
  }
}
