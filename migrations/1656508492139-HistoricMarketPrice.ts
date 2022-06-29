import { MigrationInterface, QueryRunner } from "typeorm";

export class HistoricMarketPrice1656508492139 implements MigrationInterface {
  name = "HistoricMarketPrice1656508492139";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "historic_market_price" (
            "id" SERIAL NOT NULL, 
            "symbol" character varying NOT NULL, 
            "date" date NOT NULL, 
            "usd" numeric NOT NULL, 
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
            CONSTRAINT "UK_historyic_market_price_symbol_date" UNIQUE ("symbol", "date"), 
            CONSTRAINT "PK_b0a22436b47e742187aa7408561" PRIMARY KEY ("id")
        )`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "usdPrice" numeric`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "usdPrice"`);
    await queryRunner.query(`DROP TABLE "historic_market_price"`);
  }
}
