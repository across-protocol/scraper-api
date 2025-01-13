import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export type RewardMetadata = {
  rate: number;
};

@Entity()
export class OpRewardsStats {
  @PrimaryColumn()
  id: number;

  @Column({ type: "decimal" })
  totalTokenAmount: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
