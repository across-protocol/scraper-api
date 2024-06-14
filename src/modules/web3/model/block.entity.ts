import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique("UK_block_blockNumber_chainId", ["blockNumber", "chainId"])
@Index("IDX_block_chainId_date", ["chainId", "date"])
export class Block {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  blockNumber: number;

  @Column()
  chainId: number;

  @Column()
  date: Date;

  @CreateDateColumn()
  createdAt: Date;
}
