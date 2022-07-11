import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique("UK_transaction_chainId_hash", ["chainId", "hash"])
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chainId: number;

  @Column()
  hash: string;

  @Column({ default: 0 })
  blockNumber: number;

  @Column()
  data: string;

  @CreateDateColumn()
  createdAt: number;
}
