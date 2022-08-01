import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1659106715325 implements MigrationInterface {
  name = "Deposit1659106715325";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "bridgeFeePct" numeric NOT NULL DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "bridgeFeePct"`);
  }
}
