import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

export type RequestedSpeedUpDepositEv2Args = {
  newRelayerFeePct: string;
  depositId: number;
  depositor: string;
  depositorSignature: string;
};

export type RequestedSpeedUpDepositEv2_5Args = {
  newRelayerFeePct: string;
  depositId: number;
  depositor: string;
  updatedRecipient: string;
  updatedMessage: string;
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
  args: RequestedSpeedUpDepositEv2Args | RequestedSpeedUpDepositEv2_5Args;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
