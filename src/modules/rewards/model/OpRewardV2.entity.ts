import { Token } from "../../web3/model/token.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { RewardedDeposit } from "./RewardedDeposit.entity";

@Entity()
@Unique("UK_opRewardV2_recipient_depId_chainId", ["recipient", "depositId", "originChainId"])
@Index("IX_op_reward_v2_recipient", ["recipient"])
export class OpRewardV2 {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  depositId: number;

  @Column()
  originChainId: number;

  @OneToOne(() => RewardedDeposit)
  @JoinColumn([
    { name: "depositId", referencedColumnName: "depositId", foreignKeyConstraintName: "FK_op_reward_deposit" },
    { name: "originChainId", referencedColumnName: "originChainId", foreignKeyConstraintName: "FK_op_reward_deposit" },
  ])
  deposit: RewardedDeposit;

  @Column()
  depositDate: Date;

  @Column()
  recipient: string;

  @Column({ type: "decimal" })
  rate: string;

  @Column()
  amount: string;

  @Column()
  amountUsd: string;

  @Column()
  rewardTokenId: number;

  @ManyToOne(() => Token)
  @JoinColumn([{ name: "rewardTokenId", referencedColumnName: "id", foreignKeyConstraintName: "FK_op_reward_token" }])
  rewardToken: Token;

  // The window index set in the MerkleDistributor contract
  @Column({ nullable: true })
  windowIndex: number;

  @Column({ default: false })
  isClaimed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
