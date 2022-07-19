import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1658238358996 implements MigrationInterface {
  name = "Deposit1658238358996";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "stickyReferralAddress" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "stickyReferralAddress"`);
  }
}
