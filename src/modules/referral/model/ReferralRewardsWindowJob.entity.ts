import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum RewardsWindowJobStatus {
  Initial = "Initial",
  InProgress = "InProgress",
  Done = "Done",
  Failed = "Failed",
}

export type ReferralRewardsWindowJobConfig = {
  maxDepositDate: string;
};

/**
 * @description This class represents a job for creating referral rewards windows
 */
@Entity()
export class RewardsWindowJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  windowIndex: number;

  @Column({ default: RewardsWindowJobStatus.Initial })
  status: RewardsWindowJobStatus;

  @Column({ type: "jsonb" })
  config: ReferralRewardsWindowJobConfig;

  @Column({ nullable: true })
  error?: string;

  /** job execution time in seconds */
  @Column({ type: "decimal", nullable: true })
  executionTime?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
