import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionReceipt1700850247611 implements MigrationInterface {
  name = "TransactionReceipt1700850247611";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transaction_receipt" ALTER COLUMN "to" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transaction_receipt" ALTER COLUMN "contractAddress" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transaction_receipt" ALTER COLUMN "contractAddress" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "transaction_receipt" ALTER COLUMN "to" SET NOT NULL`);
  }
}
