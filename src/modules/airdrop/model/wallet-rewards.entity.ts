import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity()
@Unique("UK_wallet_rewards_walletAddress", ["walletAddress"])
@Index("IX_wallet_rewards_walletAddress", ["walletAddress"])
export class WalletRewards {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  walletAddress: string;

  @Column({ type: "decimal" })
  welcomeTravellerRewards: string;

  @Column({ type: "decimal" })
  earlyUserRewards: string;

  @Column({ type: "decimal" })
  liquidityProviderRewards: string;

  @Column({ default: true })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
