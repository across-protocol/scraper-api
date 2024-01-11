import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class ReferralRewardsWindowJobResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  jobId: number;

  @Column()
  windowIndex: number;

  @Column({ type: "decimal" })
  totalRewardsAmount: string;

  @Column()
  address: string;

  @Column({ type: "decimal" })
  amount: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
