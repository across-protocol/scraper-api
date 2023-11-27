import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique("UK_transaction_receipt_chainId_hash", ["chainId", "hash"])
export class TransactionReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chainId: number;

  @Column()
  from: string;

  @Column({ nullable: true })
  to?: string;

  @Column({ nullable: true })
  contractAddress: string;

  @Column()
  transactionIndex: number;

  @Column()
  hash: string;

  @Column()
  blockHash: string;

  @Column()
  blockNumber: number;

  @Column({ type: "decimal" })
  effectiveGasPrice: string;

  @Column({ type: "decimal" })
  gasUsed: string;

  @CreateDateColumn()
  createdAt: number;
}
