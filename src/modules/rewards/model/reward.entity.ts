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

export type RewardType = "referrals" | "op-rebates";
export type RewardMetadata =
  | {
      type: "referrals";
      tier: number;
      rate: number;
    }
  | {
      type: "op-rebates";
      rate: number;
    };

@Entity()
@Unique("UK_reward_recipient_type_depositPk", ["recipient", "type", "depositPrimaryKey"])
@Index("IX_reward_recipient_type", ["recipient", "type"])
export class Reward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  depositPrimaryKey: number;

  @ManyToOne(() => Deposit)
  @JoinColumn([{ name: "depositPrimaryKey", referencedColumnName: "id" }])
  deposit: Deposit;

  @Column()
  recipient: string;

  @Column()
  type: RewardType;

  @Column({ type: "jsonb" })
  metadata: RewardMetadata;

  @Column()
  amount: string;

  @Column()
  amountUsd: string;

  @Column()
  rewardTokenId: number;

  @ManyToOne(() => Token)
  @JoinColumn([{ name: "rewardTokenId", referencedColumnName: "id" }])
  rewardToken: Token;

  @Column({ default: -1 })
  claimedWindowIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
