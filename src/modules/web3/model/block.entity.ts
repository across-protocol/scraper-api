import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique("UK_block_blockNumber_chainId", ["blockNumber", "chainId"])
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
