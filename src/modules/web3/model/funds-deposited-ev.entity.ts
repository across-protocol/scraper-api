import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

export type FundsDepositedEvArgs = {
  amount: string;
  originChainId: string;
  destinationChainId: string;
  relayerFeePct: string;
  depositId: number;
  quoteTimestamp: number;
  originToken: string;
  recipient: string;
  depositor: string;
};
@Entity({
  schema: "events",
})
@Unique("UK_funds_deposited_ev_transactionHash_logIndex", ["transactionHash", "logIndex"])
export class FundsDepositedEv {
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
  args: FundsDepositedEvArgs;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
