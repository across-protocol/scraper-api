import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionReceipt1715602684749 implements MigrationInterface {
  name = "TransactionReceipt1715602684749";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transaction_receipt" ADD "logs" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transaction_receipt" DROP COLUMN "logs"`);
  }
}
