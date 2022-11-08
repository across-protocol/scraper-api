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
import { HistoricMarketPrice } from "../../market-price/model/historic-market-price.entity";

export type TransferStatus = "pending" | "filled";
export type DepositFillTx = {
  hash: string;
  totalFilledAmount: string;
  fillAmount: string;
  realizedLpFeePct: string;
  appliedRelayerFeePct: string;
  date?: string;
};

@Entity()
@Unique("UK_deposit_depositId_sourceChainId", ["depositId", "sourceChainId"])
@Index("IX_deposit_depositorAddr", ["depositorAddr"])
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

  @Column({ nullable: true })
  filledDate?: Date;

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

  @Column({ type: "decimal", default: 0 })
  realizedLpFeePctCapped: string;

  @Column({ type: "decimal", default: 0 })
  bridgeFeePct: string;

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
  fillTxs: DepositFillTx[];

  @Column()
  blockNumber: number;

  @Column({ nullable: true })
  referralAddress?: string;

  @Column({ nullable: true })
  stickyReferralAddress?: string;

  @Column({ nullable: true })
  rewardsWindowIndex?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
