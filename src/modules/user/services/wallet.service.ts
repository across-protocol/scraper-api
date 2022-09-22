import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { utils } from "ethers";

import { Wallet } from "../model/wallet.entity";
import { User } from "../model/user.entity";
import { InvalidSignatureException, UserNotFoundException, WalletNotFoundException } from "./exceptions";

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private walletRepository: Repository<Wallet>,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  public async upsertWallet({ userId, walletAddress }: { userId: number; walletAddress: string }) {
    await this.assertUserExists(userId);

    let wallet = await this.walletRepository.findOne({
      where: {
        userId,
      },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        userId,
        walletAddress,
      });
    } else {
      wallet.walletAddress = walletAddress;
    }

    wallet = await this.walletRepository.save(wallet);

    return wallet;
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
    return this.walletRepository.delete({
      userId,
    });
  }

  public async assertWalletForUserExists(userId: number) {
    const wallet = await this.walletRepository.findOne({
      where: {
        userId,
      },
    });

    if (!wallet) {
      throw new WalletNotFoundException(userId);
    }
  }

  public async assertUserExists(userId: number) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UserNotFoundException();
    }
  }
}
