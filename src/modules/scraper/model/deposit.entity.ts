import { Token } from "../../web3/model/token.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type TransferStatus = "pending" | "filled";

@Entity()
export class Deposit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  depositId: number;

  @Column()
  sourceChainId: number;

  @Column()
  destinationChainId: number;

  @Column({ nullable: true })
  depositDate: Date;

  @Column()
  depositorAddr: string;

  @Column({ default: "pending" })
  status: TransferStatus;

  @Column({ type: "decimal" })
  amount: string;

  @Column({ type: "decimal", default: 0 })
  filled: string;

  @Column({ type: "decimal", default: 0 })
  realizedLpFeePct: string;

  @Column()
  tokenAddr: string;

  @Column()
  tokenId?: number;

  @ManyToOne(() => Token)
  @JoinColumn([{ name: "tokenId", referencedColumnName: "id" }])
  token?: Token;

  @Column()
  depositTxHash: string;

  @Column({ type: "jsonb", default: [] })
  fillTxs: string[];

  @Column()
  blockNumber: number;

  @Column({ nullable: true })
  referralAddress?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
