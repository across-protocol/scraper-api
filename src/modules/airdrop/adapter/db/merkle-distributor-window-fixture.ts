import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MerkleDistributorWindow } from "../../model/merkle-distributor-window.entity";

@Injectable()
export class MerkleDistributorWindowFixture {
  public constructor(
    @InjectRepository(MerkleDistributorWindow)
    private merkleDistributorWindowRepository: Repository<MerkleDistributorWindow>,
  ) {}

  public insertMerkleDistributorWindow(args: Partial<MerkleDistributorWindow> = {}) {
    const deposit = this.merkleDistributorWindowRepository.create(this.mockMerkleDistributorWindowEntity(args));
    return this.merkleDistributorWindowRepository.save(deposit);
  }

  public insertManyMerkleDistributorWindows(args: Partial<MerkleDistributorWindow>[] = [{}]) {
    const createdDeposits = this.merkleDistributorWindowRepository.create(
      args.map((arg) => this.mockMerkleDistributorWindowEntity(arg)),
    );
    return this.merkleDistributorWindowRepository.save(createdDeposits);
  }

  public mockMerkleDistributorWindowEntity(
    overrides: Partial<MerkleDistributorWindow> = {},
  ): Partial<MerkleDistributorWindow> {
    return {
      chainId: 1,
      windowIndex: 0,
      contractAddress: "0x",
      rewardToken: "0x",
      rewardsToDeposit: "10",
      merkleRoot: "0x",
      ...overrides,
    };
  }

  public deleteAllMerkleDistributorWindows() {
    return this.merkleDistributorWindowRepository.query(
      `truncate table "merkle_distributor_window" restart identity cascade`,
    );
  }
}
