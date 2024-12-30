import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity()
@Unique("UK_rewardedDeposit_depositId_originChainId", [
  "depositId",
  "originChainId",
])
export class RewardedDeposit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  relayHash: string;

  @Column()
  depositTxHash: string;

  @Column()
  depositId: number;

  @Column()
  originChainId: number;

  @Column()
  destinationChainId: number;

  @Column()
  depositor: string;

  @Column()
  recipient: string;

  @Column()
  inputToken: string;

  @Column()
  inputAmount: string;

  @Column()
  outputToken: string;

  @Column()
  outputAmount: string;

  @Column()
  exclusiveRelayer: string;

  @Column()
  depositDate: Date;

  @Column()
  fillTxHash: string;

  @Column()
  relayer: string;

  @Column()
  totalBridgeFeeUsd: string;

  @CreateDateColumn()
  createdAt: Date;
}
