import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionReceipt1700226010300 implements MigrationInterface {
  name = "TransactionReceipt1700226010300";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transaction_receipt" ("id" SERIAL NOT NULL, "chainId" integer NOT NULL, "from" character varying NOT NULL, "to" character varying NOT NULL, "contractAddress" character varying NOT NULL, "transactionIndex" integer NOT NULL, "hash" character varying NOT NULL, "blockHash" character varying NOT NULL, "blockNumber" integer NOT NULL, "effectiveGasPrice" numeric NOT NULL, "gasUsed" numeric NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UK_transaction_receipt_chainId_hash" UNIQUE ("chainId", "hash"), CONSTRAINT "PK_481076abe0c62b50172a89f7a50" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transaction_receipt"`);
  }
}
