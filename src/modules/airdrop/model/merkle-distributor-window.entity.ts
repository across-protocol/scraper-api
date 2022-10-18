import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { MerkleDistributorRecipient } from "./merkle-distributor-recipient.entity";

@Entity()
// Don't allow duplicates of the window index
@Unique("UK_merkle_distributor_window_windowIndex", ["windowIndex"])
export class MerkleDistributorWindow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chainId: number;

  @Column()
  rewardToken: string;

  @Column()
  windowIndex: number;

  @Column({ type: "decimal" })
  rewardsToDeposit: string;

  @Column()
  merkleRoot: string;

  @OneToMany(() => MerkleDistributorRecipient, (recipient) => recipient.merkleDistributorWindow)
  recipients: MerkleDistributorRecipient;

  @CreateDateColumn()
  createdAt: Date;
}
