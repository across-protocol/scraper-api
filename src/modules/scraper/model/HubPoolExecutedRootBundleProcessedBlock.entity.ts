import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class HubPoolExecutedRootBundleProcessedBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chainId: number;

  @Column()
  latestBlock: number;

  @CreateDateColumn()
  createdAt: Date;
}
