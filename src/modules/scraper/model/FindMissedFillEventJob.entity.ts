import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Deposit } from "../../deposit/model/deposit.entity";

export enum FindMissedFillEventJobStatus {
  Checking = "checking",
  Completed = "completed",
  Suspended = "suspended",
}

@Entity()
export class FindMissedFillEventJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  depositPrimaryKey: number;

  @ManyToOne(() => Deposit)
  @JoinColumn([{ name: "depositPrimaryKey", referencedColumnName: "id", foreignKeyConstraintName: "FK_fmfej_deposit" }])
  deposit: Deposit;

  @Column()
  originChainId: number;

  @Column()
  destinationChainId: number;

  @Column({ type: "decimal" })
  depositId: string;

  @Column()
  depositDate: Date;

  @Column({ default: FindMissedFillEventJobStatus.Checking })
  status: FindMissedFillEventJobStatus;

  @Column({ nullable: true })
  lastFromBlockChecked?: number;

  @Column({ nullable: true })
  lastFromDateChecked?: Date;

  @Column({ nullable: true })
  lastToBlockChecked?: number;

  @Column({ nullable: true })
  lastToDateChecked?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
