import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1659106715327 implements MigrationInterface {
  name = "Deposit1659106715327";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "stickyReferralAddress" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "stickyReferralAddress"`);
  }
}
