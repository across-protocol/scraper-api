import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class MerkleDistributorProcessedBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chainId: number;

  @Column()
  latestBlock: number;

  @CreateDateColumn()
  createdAt: Date;
}
