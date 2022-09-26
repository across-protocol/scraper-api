import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WalletRewards } from "../../model/wallet-rewards.entity";

@Injectable()
export class WalletRewardsFixture {
  public constructor(@InjectRepository(WalletRewards) private depositRepository: Repository<WalletRewards>) {}

  public insertWalletRewards(args: Partial<WalletRewards> = {}) {
    const deposit = this.depositRepository.create(this.mockWalletRewardsEntity(args));
    return this.depositRepository.save(deposit);
  }

  public insertManyWalletRewards(args: Partial<WalletRewards>[] = [{}]) {
    const createdDeposits = this.depositRepository.create(args.map((arg) => this.mockWalletRewardsEntity(arg)));
    return this.depositRepository.save(createdDeposits);
  }

  public mockWalletRewardsEntity(overrides: Partial<WalletRewards> = {}): Partial<WalletRewards> {
    return {
      earlyUserRewards: "0",
      liquidityProviderRewards: "0",
      welcomeTravellerRewards: "0",
      walletAddress: "0x0000000000000000000000000000000000000000",
      ...overrides,
    };
  }

  public deleteAllWalletRewards() {
    return this.depositRepository.query(`truncate table "wallet_rewards" restart identity cascade`);
  }
}
