import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1670925750747 implements MigrationInterface {
  name = "Deposit1670925750747";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "initialRelayerFeePct" numeric`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "speedUps" jsonb NOT NULL DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "speedUps"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "initialRelayerFeePct"`);
  }
}
