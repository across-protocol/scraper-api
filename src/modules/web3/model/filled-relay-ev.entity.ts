import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

export type FilledRelay2EvArgs = {
  amount: string;
  totalFilledAmount: string;
  fillAmount: string;
  repaymentChainId: string;
  originChainId: string;
  destinationChainId: string;
  relayerFeePct: string;
  appliedRelayerFeePct: string;
  realizedLpFeePct: string;
  depositId: number;
  destinationToken: string;
  relayer: string;
  depositor: string;
  recipient: string;
  isSlowRelay: boolean;
};

export type FilledRelay2_5EvArgs = {
  amount: string;
  totalFilledAmount: string;
  fillAmount: string;
  repaymentChainId: string;
  originChainId: string;
  destinationChainId: string;
  relayerFeePct: string;
  realizedLpFeePct: string;
  depositId: number;
  destinationToken: string;
  relayer: string;
  depositor: string;
  recipient: string;
  message: string;
  updatableRelayData: {
    recipient: string;
    message: string;
    relayerFeePct: string;
    isSlowRelay: boolean;
    payoutAdjustmentPct: string;
  };
};

@Entity({
  schema: "events",
})
@Unique("UK_filled_relay_ev_transactionHash_logIndex", ["transactionHash", "logIndex"])
export class FilledRelayEv {
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
  args: FilledRelay2EvArgs | FilledRelay2_5EvArgs;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
