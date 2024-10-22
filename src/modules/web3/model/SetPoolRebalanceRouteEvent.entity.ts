import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity({
  schema: "events",
})
@Unique("UK_sprre_transactionHash_logIndex", ["transactionHash", "logIndex"])
export class SetPoolRebalanceRouteEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  blockNumber: number;

  @Column()
  blockHash: string;

  @Column()
  transactionIndex: number;

  @Column()
  date: Date;

  @Column()
  address: string;

  @Column()
  chainId: number;

  @Column()
  transactionHash: string;

  @Column()
  logIndex: number;

  @Column()
  destinationChainId: number;

  @Column()
  l1Token: string;

  @Column()
  destinationToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
