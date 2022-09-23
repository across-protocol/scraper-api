import { Injectable, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { utils } from "ethers";

import { UserWallet } from "../model/user-wallet.entity";
import { InvalidSignatureException, WalletNotFoundException } from "./exceptions";
import { UserService } from "./user.service";

@Injectable()
export class UserWalletService {
  constructor(
    @InjectRepository(UserWallet) private userWalletRepository: Repository<UserWallet>,
    @Inject(UserService) private userService: UserService,
  ) {}

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
    this.verifySignedDiscordId({
      signature,
      discordIdMessage: discordId,
      walletAddress,
    });

    await this.userService.getUserByAttributes({ id: userId }, true);

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
    await this.assertWalletForUserExists(userId);

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

  public async assertWalletForUserExists(userId: number) {
    const wallet = await this.userWalletRepository.findOne({
      where: {
        userId,
      },
    });

    if (!wallet) {
      throw new WalletNotFoundException(userId);
    }
  }
}
