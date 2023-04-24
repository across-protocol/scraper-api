import { MigrationInterface, QueryRunner } from "typeorm";

export class RefundRequestedEvent1682328242098 implements MigrationInterface {
  name = "RefundRequestedEvent1682328242098";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events"."refund_requested_ev" (
        "id" SERIAL NOT NULL, 
        "blockNumber" integer NOT NULL, 
        "blockHash" character varying NOT NULL, 
        "transactionIndex" integer NOT NULL, 
        "address" character varying NOT NULL, 
        "chainId" integer NOT NULL, 
        "transactionHash" character varying NOT NULL, 
        "logIndex" integer NOT NULL, 
        "args" jsonb NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_refund_requested_ev_transactionHash_logIndex" UNIQUE ("transactionHash", "logIndex"), CONSTRAINT "PK_fe4e8e0dc6a7229e92f317f646b" PRIMARY KEY ("id"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"."refund_requested_ev"`);
  }
}
