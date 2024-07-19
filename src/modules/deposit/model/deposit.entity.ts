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
export type DepositFillTx2 = {
  hash: string;
  totalFilledAmount: string;
  fillAmount: string;
  realizedLpFeePct: string;
  relayerFeePct: string;
  date?: string;
};
export type DepositFillTxV3 = {
  updatedRecipient: string;
  updatedMessage: string;
  updatedOutputAmount: string;
  fillType: number;
  hash: string;
  date?: string;
};
export type RequestedSpeedUpDepositTx = {
  hash: string;
  blockNumber: number;
  newRelayerFeePct: string;
  depositSourceChainId: number;
  updatedRecipient?: string;
  updatedMessage?: string;
};
export type RequestedSpeedUpDepositTxV3 = {
  hash: string;
  blockNumber: number;
  updatedOutputAmount: string;
  updatedRecipient: string;
  updatedMessage: string;
};
export type FeeBreakdown = {
  // lp fee
  lpFeeUsd: string;
  lpFeePct: string; // wei pct
  lpFeeAmount: string;
  // relayer fee
  relayCapitalFeeUsd: string;
  relayCapitalFeePct: string; // wei pct
  relayCapitalFeeAmount: string;
  relayGasFeeUsd: string;
  relayGasFeePct: string; // wei pct
  relayGasFeeAmount: string;
  // total = lp fee + relayer fee
  totalBridgeFeeUsd: string;
  totalBridgeFeePct: string; // wei pct
  totalBridgeFeeAmount: string;
  // swap fee
  swapFeeUsd?: string;
  swapFeePct?: string; // wei pct
  swapFeeAmount?: string;
};

export type PartialDeposit = Pick<
  Deposit,
  "id" | "status" | "depositDate" | "amount" | "destinationChainId" | "sourceChainId" | "feeBreakdown" | "depositTxHash" | "price" | "token"
>;

@Entity()
@Unique("UK_deposit_depositId_sourceChainId", ["depositId", "sourceChainId"])
@Index("IX_deposit_depositorAddr", ["depositorAddr"])
@Index("IX_deposit_srAddress_depositDate_pId_tId_status", [
  "stickyReferralAddress",
  "depositDate",
  "priceId",
  "tokenId",
  "status",
])
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

  @Column()
  recipientAddr: string;

  @Column({ default: "0x" })
  message: string;

  @Column({ default: "pending" })
  status: TransferStatus;

  @Column({ type: "decimal" })
  amount: string;

  @Column({ type: "decimal", default: 0 })
  filled: string;

  @Column({ type: "decimal", default: 0 })
  realizedLpFeePct: string;

  @Column({ type: "decimal" })
  depositRelayerFeePct?: string;

  @Column({ type: "decimal", nullable: true })
  initialRelayerFeePct?: string;

  @Column({ type: "decimal", default: 100000000000000 }) // default 1bp = 0.01%
  suggestedRelayerFeePct: string;

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

  @Column({ type: "decimal", nullable: true })
  outputAmount?: string;

  @Column({ nullable: true })
  outputTokenAddress?: string;

  @Column({ nullable: true })
  outputTokenId?: number;

  @ManyToOne(() => Token)
  @JoinColumn([
    { name: "outputTokenId", referencedColumnName: "id", foreignKeyConstraintName: "FK_deposit_outputTokenId" },
  ])
  outputToken?: Token;

  @Column({ nullable: true })
  outputTokenPriceId?: number;

  @ManyToOne(() => HistoricMarketPrice)
  @JoinColumn([
    {
      name: "outputTokenPriceId",
      referencedColumnName: "id",
      foreignKeyConstraintName: "FK_deposit_outputTokenPriceId",
    },
  ])
  outputTokenPrice?: HistoricMarketPrice;

  @Column()
  depositTxHash: string;

  @Column({ type: "jsonb", default: [] })
  fillTxs: (DepositFillTx | DepositFillTx2 | DepositFillTxV3)[];

  @Column({ type: "jsonb", default: [] })
  speedUps: RequestedSpeedUpDepositTx[] | RequestedSpeedUpDepositTxV3[];

  @Column({ type: "jsonb", default: {} })
  feeBreakdown: FeeBreakdown;

  @Column()
  blockNumber: number;

  @Column({ nullable: true })
  referralAddress?: string;

  @Column({ nullable: true })
  stickyReferralAddress?: string;

  @Column({ nullable: true })
  rewardsWindowIndex?: number;

  @Column({ type: "decimal", nullable: true })
  acxUsdPrice?: string;

  @Column({ nullable: true })
  fillDeadline?: Date;

  @Column({ nullable: true })
  exclusivityDeadline?: Date;

  @Column({ nullable: true })
  relayer?: string;

  @Column({ nullable: true })
  swapTokenAddress?: string;

  @Column({ nullable: true })
  swapTokenId?: number;

  @ManyToOne(() => Token)
  @JoinColumn([{ name: "swapTokenId", referencedColumnName: "id", foreignKeyConstraintName: "FK_deposit_swapTokenId" }])
  swapToken?: Token;

  @Column({ type: "decimal", nullable: true })
  swapTokenAmount?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
