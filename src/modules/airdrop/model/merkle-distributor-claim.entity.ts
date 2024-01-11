import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { MerkleDistributorWindow } from "./merkle-distributor-window.entity";

@Entity()
@Unique("UK_mdc_mdWindowId_account", ["merkleDistributorWindowId", "account"])
export class MerkleDistributorClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  caller: string;

  @Column()
  accountIndex: number;

  @Column()
  windowIndex: number;

  @Column()
  account: string;

  @Column()
  rewardToken: string;

  @Column()
  blockNumber: number;

  @Column()
  contractAddress: string;

  @Column()
  claimedAt: Date;

  @Column()
  merkleDistributorWindowId: number;

  @ManyToOne(() => MerkleDistributorWindow, (window) => window.claims)
  @JoinColumn([
    { name: "merkleDistributorWindowId", referencedColumnName: "id", foreignKeyConstraintName: "FK_mdc_window" },
  ])
  merkleDistributorWindow: MerkleDistributorWindow;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
