import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum ReferralRewardsWindowJobStatus {
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
export class ReferralRewardsWindowJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  windowIndex: number;

  @Column({ default: ReferralRewardsWindowJobStatus.Initial })
  status: ReferralRewardsWindowJobStatus;

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
