import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1699623683373 implements MigrationInterface {
  name = "Deposit1699623683373";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "feeBreakdown" jsonb NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "feeBreakdown"`);
  }
}
