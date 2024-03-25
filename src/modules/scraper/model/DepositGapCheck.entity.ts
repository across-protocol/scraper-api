import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

/**
 * Table that stores the deposit ids for which the preceding deposits don't have gaps.
 */
@Entity()
export class DepositGapCheck {
  @PrimaryColumn()
  originChainId: number;

  @PrimaryColumn()
  depositId: number;

  @Column()
  passed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
