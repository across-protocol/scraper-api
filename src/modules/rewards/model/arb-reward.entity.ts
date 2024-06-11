import { Token } from "../../web3/model/token.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Deposit } from "../../deposit/model/deposit.entity";

export type RewardMetadata = {
  rate: number;
};

@Entity()
@Unique("UK_arb_reward_recipient_depositPk", ["recipient", "depositPrimaryKey"])
@Index("IX_arb_reward_recipient_depositDate", ["recipient", "depositDate"])
export class ArbReward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  depositPrimaryKey: number;

  @ManyToOne(() => Deposit)
  @JoinColumn([
    { name: "depositPrimaryKey", referencedColumnName: "id", foreignKeyConstraintName: "FK_arb_reward_deposit" },
  ])
  deposit: Deposit;

  @Column()
  depositDate: Date;

  @Column()
  recipient: string;

  @Column({ type: "jsonb" })
  metadata: RewardMetadata;

  @Column()
  amount: string;

  @Column()
  amountUsd: string;

  @Column()
  rewardTokenId: number;

  @ManyToOne(() => Token)
  @JoinColumn([{ name: "rewardTokenId", referencedColumnName: "id", foreignKeyConstraintName: "FK_arb_reward_token" }])
  rewardToken: Token;

  /**
   * The window index set in the MerkleDistributor contract
   */
  @Column({ nullable: true })
  windowIndex: number;

  @Column({ default: false })
  isClaimed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
