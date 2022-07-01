import { Token } from "../../web3/model/token.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { HistoricMarketPrice } from "../../market-price/model/historic-market-price.entity";

export type TransferStatus = "pending" | "filled";

@Entity()
@Unique("UK_deposit_depositId_sourceChainId", ["depositId", "sourceChainId"])
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
  depositDate?: Date;

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

  @Column({ nullable: true })
  tokenId?: number;

  @ManyToOne(() => Token)
  @JoinColumn([{ name: "tokenId", referencedColumnName: "id" }])
  token?: Token;

  @Column({ nullable: true })
  priceId?: number;

  @ManyToOne(() => HistoricMarketPrice)
  @JoinColumn([{ name: "priceId", referencedColumnName: "id" }])
  price?: HistoricMarketPrice;

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
