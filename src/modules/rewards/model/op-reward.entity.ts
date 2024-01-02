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
@Unique("UK_op_reward_recipient_depositPk", ["recipient", "depositPrimaryKey"])
@Index("IX_op_reward_recipient", ["recipient"])
export class OpReward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  depositPrimaryKey: number;

  @ManyToOne(() => Deposit)
  @JoinColumn([
    { name: "depositPrimaryKey", referencedColumnName: "id", foreignKeyConstraintName: "FK_op_reward_deposit" },
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
  @JoinColumn([{ name: "rewardTokenId", referencedColumnName: "id", foreignKeyConstraintName: "FK_op_reward_token" }])
  rewardToken: Token;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
