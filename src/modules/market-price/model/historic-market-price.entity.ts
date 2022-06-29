import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique("UK_historyic_market_price_symbol_date", ["symbol", "date"])
export class HistoricMarketPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  symbol: string;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "decimal" })
  usd: string;

  @CreateDateColumn()
  createdAt: Date;
}
