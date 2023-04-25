import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

export type RefundRequestedEvArgs = {
  relayer: string;
  refundToken: string;
  amount: string;
  originChainId: string;
  destinationChainId: string;
  realizedLpFeePct: string;
  depositId: number;
  fillBlock: string;
  previousIdenticalRequests: string;
};
@Entity({
  schema: "events",
})
@Unique("UK_refund_requested_ev_transactionHash_logIndex", ["transactionHash", "logIndex"])
export class RefundRequestedEv {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  blockNumber: number;

  @Column()
  blockHash: string;

  @Column()
  transactionIndex: number;

  @Column()
  address: string;

  @Column()
  chainId: number;

  @Column()
  transactionHash: string;

  @Column()
  logIndex: number;

  @Column({ type: "jsonb" })
  args: RefundRequestedEvArgs;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
