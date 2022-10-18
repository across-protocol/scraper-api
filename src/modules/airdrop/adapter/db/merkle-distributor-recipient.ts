import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MerkleDistributorRecipient } from "../../model/merkle-distributor-recipient.entity";

@Injectable()
export class MerkleDistributorRecipientFixture {
  public constructor(
    @InjectRepository(MerkleDistributorRecipient)
    private merkleDistributorRecipientRepository: Repository<MerkleDistributorRecipient>,
  ) {}

  public insertMerkleDistributorRecipient(args: Partial<MerkleDistributorRecipient> = {}) {
    const deposit = this.merkleDistributorRecipientRepository.create(this.mockMerkleDistributorRecipientEntity(args));
    return this.merkleDistributorRecipientRepository.save(deposit);
  }

  public insertManyMerkleDistributorRecipients(args: Partial<MerkleDistributorRecipient>[] = [{}]) {
    const createdDeposits = this.merkleDistributorRecipientRepository.create(
      args.map((arg) => this.mockMerkleDistributorRecipientEntity(arg)),
    );
    return this.merkleDistributorRecipientRepository.save(createdDeposits);
  }

  public mockMerkleDistributorRecipientEntity(
    overrides: Partial<MerkleDistributorRecipient> = {},
  ): Partial<MerkleDistributorRecipient> {
    return {
      merkleDistributorWindowId: 0,
      address: "0x",
      amount: "10",
      accountIndex: 0,
      proof: ["ox"],
      payload: {},
      ...overrides,
    };
  }

  public deleteAllMerkleDistributorRecipients() {
    return this.merkleDistributorRecipientRepository.query(
      `truncate table "merkle_distributor_recipient" restart identity cascade`,
    );
  }
}
