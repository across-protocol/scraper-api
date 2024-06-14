import { MigrationInterface, QueryRunner } from "typeorm";

export class Block1718360324149 implements MigrationInterface {
  name = "Block1718360324149";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_block_chainId_date" ON "block" ("chainId", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_block_chainId_date"`);
  }
}
