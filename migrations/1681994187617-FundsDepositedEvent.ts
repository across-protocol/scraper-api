import { MigrationInterface, QueryRunner } from "typeorm";

export class FundsDepositedEvent1681994187617 implements MigrationInterface {
  name = "FundsDepositedEvent1681994187617";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "events"."funds_deposited_ev" (
      "id" SERIAL NOT NULL, 
      "blockNumber" integer NOT NULL, 
      "blockHash" character varying NOT NULL, 
      "transactionIndex" integer NOT NULL, 
      "address" character varying NOT NULL, 
      "transactionHash" character varying NOT NULL, 
      "logIndex" integer NOT NULL, 
      "args" jsonb NOT NULL, 
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
      CONSTRAINT "UK_funds_deposited_ev_transactionHash_logIndex" UNIQUE ("transactionHash", "logIndex"), 
      CONSTRAINT "PK_1bad80fe95a5d4df53aa9c021fd" PRIMARY KEY ("id"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"."funds_deposited_ev"`);
  }
}
