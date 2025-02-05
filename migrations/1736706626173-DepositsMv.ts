import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositsMv1736706626173 implements MigrationInterface {
  name = "DepositsMv1736706626173";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW "deposits_mv"`);
  }

  public async down(): Promise<void> {
  }
}
