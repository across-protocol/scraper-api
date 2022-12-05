import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1669984610619 implements MigrationInterface {
  name = "Deposit1669984610619";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "acxUsdPrice" numeric`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "acxUsdPrice"`);
  }
}
