import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";

@Entity()
@Unique("UK_wallet_id_walletAddress", ["id", "walletAddress"])
export class Wallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  userId: number;

  @OneToOne(() => User)
  @JoinColumn([{ name: "userId", referencedColumnName: "id" }])
  user?: User;

  @Column()
  walletAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
