import { MigrationInterface, QueryRunner } from "typeorm";

export class Transaction1657214907158 implements MigrationInterface {
  name = "Transaction1657214907158";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transaction" ADD "blockNumber" integer NOT NULL DEFAULT '0'`);
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "UK_transaction_chainId_hash" UNIQUE ("chainId", "hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "UK_transaction_chainId_hash"`);
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "blockNumber"`);
  }
}
