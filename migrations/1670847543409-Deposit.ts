import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1670847543409 implements MigrationInterface {
  name = "Deposit1670847543409";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "suggestedRelayerFeePct" numeric`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "suggestedRelayerFeePct"`);
  }
}
