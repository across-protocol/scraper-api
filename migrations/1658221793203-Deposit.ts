import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1658221793203 implements MigrationInterface {
  name = "Deposit1658221793203";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "realizedLpFeePctCapped" numeric NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "realizedLpFeePctCapped"`);
  }
}
