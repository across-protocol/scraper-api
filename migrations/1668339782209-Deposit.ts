import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1668339782209 implements MigrationInterface {
  name = "Deposit1668339782209";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "depositRelayerFeePct" numeric`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "depositRelayerFeePct"`);
  }
}
