import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1666867200884 implements MigrationInterface {
  name = "Deposit1666867200884";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "filledDate" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "filledDate"`);
  }
}
