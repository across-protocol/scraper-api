import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique("UK_token_address_chainId", ["address", "chainId"])
export class Token {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  address: string;

  @Column()
  chainId: number;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column()
  decimals: number;

  @CreateDateColumn()
  createdAt: Date;
}
