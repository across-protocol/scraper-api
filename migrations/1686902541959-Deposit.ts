import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1686902541959 implements MigrationInterface {
  name = "Deposit1686902541959";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "message" character varying NOT NULL DEFAULT '0x'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "message"`);
  }
}
