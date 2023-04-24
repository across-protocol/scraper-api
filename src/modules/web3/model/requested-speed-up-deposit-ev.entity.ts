import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

export type RequestedSpeedUpDepositEventArgs = {
  newRelayerFeePct: string;
  depositId: number;
  depositor: string;
  depositorSignature: string;
};
@Entity({
  schema: "events",
})
@Unique("UK_requested_speed_up_deposit_ev_transactionHash_logIndex", ["transactionHash", "logIndex"])
export class RequestedSpeedUpDepositEv {
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
  args: RequestedSpeedUpDepositEventArgs;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
