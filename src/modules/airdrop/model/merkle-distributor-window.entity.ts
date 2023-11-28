import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { MerkleDistributorRecipient } from "./merkle-distributor-recipient.entity";
import { Claim } from "./claim.entity";

@Entity()
// Don't allow duplicates of the window index
@Unique("UK_mdw_chainId_contractAddress_windowIndex", ["chainId", "contractAddress", "windowIndex"])
export class MerkleDistributorWindow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chainId: number;

  @Column()
  contractAddress: string;

  @Column()
  windowIndex: number;

  @Column()
  rewardToken: string;

  @Column({ type: "decimal" })
  rewardsToDeposit: string;

  @Column()
  merkleRoot: string;

  @Column({ nullable: true })
  ipfsHash?: string;

  @OneToMany(() => MerkleDistributorRecipient, (recipient) => recipient.merkleDistributorWindow)
  recipients: MerkleDistributorRecipient;

  @OneToMany(() => Claim, (claim) => claim.merkleDistributorWindow)
  claims: Claim;

  @CreateDateColumn()
  createdAt: Date;
}
