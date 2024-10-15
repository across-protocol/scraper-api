import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1728474857771 implements MigrationInterface {
  name = "Deposit1728474857771";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "quoteTimestamp" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "quoteTimestamp"`);
  }
}
