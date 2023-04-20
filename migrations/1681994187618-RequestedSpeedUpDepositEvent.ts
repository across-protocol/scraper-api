import { MigrationInterface, QueryRunner } from "typeorm";

export class RequestedSpeedUpDepositEvent1681994187618 implements MigrationInterface {
  name = "RequestedSpeedUpDepositEvent1681994187618";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events"."requested_speed_up_deposit_ev" (
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
        CONSTRAINT "UK_requested_speed_up_deposit_ev_transactionHash_logIndex" UNIQUE ("transactionHash", "logIndex"), 
        CONSTRAINT "PK_8be65d0fb646809cb644f627757" PRIMARY KEY ("id"))
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"."requested_speed_up_deposit_ev"`);
  }
}
