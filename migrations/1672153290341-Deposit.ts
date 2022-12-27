import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1672153290341 implements MigrationInterface {
  name = "Deposit1672153290341";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "recipientAddr" character varying`);
    await queryRunner.query(`UPDATE "deposit" SET "recipientAddr" = "depositorAddr" WHERE "recipientAddr" IS NULL`);
    await queryRunner.query(`ALTER TABLE "deposit" ALTER COLUMN "recipientAddr" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "recipientAddr"`);
  }
}
