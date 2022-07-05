import { MigrationInterface, QueryRunner } from "typeorm";

export class HistoricMarketPrice1656523050781 implements MigrationInterface {
  name = "HistoricMarketPrice1656523050781";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "priceId" integer`);
    await queryRunner.query(
      `ALTER TABLE "deposit" ADD CONSTRAINT "FK_dc62ca9eed2d18eae35c62021ea" FOREIGN KEY ("priceId") REFERENCES "historic_market_price"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP CONSTRAINT "FK_dc62ca9eed2d18eae35c62021ea"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "priceId"`);
  }
}
