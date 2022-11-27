import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity()
@Unique("UK_drs_depositId", ["depositId"])
export class DepositReferralStat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  depositId: number;

  @Column()
  referralCount: number;

  @Column({ type: "decimal" })
  referralVolume: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
