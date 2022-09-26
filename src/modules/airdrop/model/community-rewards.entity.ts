import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity()
@Index("IX_community_rewards_discordId", ["discordId"])
@Unique("UK_community_rewards_discordId", ["discordId"])
export class CommunityRewards {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  discordId: string;

  @Column({ type: "decimal" })
  amount: string;

  @Column({ default: true })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
