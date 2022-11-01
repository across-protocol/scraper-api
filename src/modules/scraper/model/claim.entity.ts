import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity()
@Unique("UK_claim_windowIndex_accountIndex", ["windowIndex", "accountIndex"])
@Index("IX_claim_account", ["account"])
export class Claim {
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
  claimedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
