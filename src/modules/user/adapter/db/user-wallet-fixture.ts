import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserWallet } from "../../model/user-wallet.entity";

@Injectable()
export class UserWalletFixture {
  public constructor(@InjectRepository(UserWallet) private userWalletRepository: Repository<UserWallet>) {}

  public insertUserWallet(args: Partial<UserWallet> = {}) {
    const user = this.userWalletRepository.create(this.mockUserWalletEntity(args));
    return this.userWalletRepository.save(user);
  }

  public mockUserWalletEntity(overrides: Partial<UserWallet> = {}): Partial<UserWallet> {
    return {
      userId: 1,
      walletAddress: "0x",
      ...overrides,
    };
  }

  public deleteAllUserWallets() {
    return this.userWalletRepository.query(`truncate table "user_wallet" restart identity cascade`);
  }
}
