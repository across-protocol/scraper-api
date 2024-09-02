import { MigrationInterface, QueryRunner } from "typeorm";

export class SetPoolRebalanceRouteEvent1721045885663 implements MigrationInterface {
  name = "SetPoolRebalanceRouteEvent1721045885663";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "events"."set_pool_rebalance_route_event" (
        "id" SERIAL NOT NULL, 
        "blockNumber" integer NOT NULL, 
        "blockHash" character varying NOT NULL, 
        "transactionIndex" integer NOT NULL, 
        "address" character varying NOT NULL, 
        "chainId" integer NOT NULL, 
        "transactionHash" character varying NOT NULL, 
        "logIndex" integer NOT NULL, 
        "destinationChainId" integer NOT NULL, 
        "l1Token" character varying NOT NULL, 
        "destinationToken" character varying NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_sprre_transactionHash_logIndex" UNIQUE ("transactionHash", "logIndex"), 
        CONSTRAINT "PK_1acd4d3e93afc21bfedc3d99892" PRIMARY KEY ("id"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE "events"."set_pool_rebalance_route_event"`
    );
  }
}
