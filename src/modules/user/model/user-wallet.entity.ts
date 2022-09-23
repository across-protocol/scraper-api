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
@Unique("UK_userWallet_id_walletAddress", ["id", "walletAddress"])
@Unique("UK_userWallet_userId", ["userId"])
export class UserWallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
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
