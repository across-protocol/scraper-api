import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { MerkleDistributorWindow } from "./merkle-distributor-window.entity";

export type MerkleDistributorRecipientPayload = {
  amountBreakdown?: {
    communityRewards: string;
    liquidityProviderRewards: string;
    earlyUserRewards: string;
    welcomeTravelerRewards: string;
  };
};

@Entity()
// A recipient address can't appear twice for the same window
@Unique("UK_merkle_distributor_recipient_merkleDistributorWindowId_address", ["merkleDistributorWindowId", "address"])
export class MerkleDistributorRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  merkleDistributorWindowId: number;

  @ManyToOne(() => MerkleDistributorWindow, (window) => window.recipients)
  merkleDistributorWindow: MerkleDistributorWindow;

  @Column()
  address: string;

  @Column({ type: "decimal" })
  amount: string;

  @Column()
  accountIndex: number;

  @Column({ type: "jsonb" })
  proof: string[];

  @Column({ type: "jsonb" })
  payload: MerkleDistributorRecipientPayload;

  @CreateDateColumn()
  createdAt: Date;
}
