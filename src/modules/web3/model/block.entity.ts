import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
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
