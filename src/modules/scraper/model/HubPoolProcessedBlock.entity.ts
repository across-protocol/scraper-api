import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class HubPoolProcessedBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chainId: number;

  @Column()
  latestBlock: number;

  @CreateDateColumn()
  createdAt: Date;
}
