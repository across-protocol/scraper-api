import { MigrationInterface, QueryRunner } from "typeorm";

export class FilledRelayEvent1681994187619 implements MigrationInterface {
  name = "FilledRelayEvent1681994187619";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events"."filled_relay_ev" (
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
        CONSTRAINT "UK_filled_relay_ev_transactionHash_logIndex" UNIQUE ("transactionHash", "logIndex"), 
        CONSTRAINT "PK_db37271439c186616b1473bc4b2" PRIMARY KEY ("id"))
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"."filled_relay_ev"`);
  }
}
