import { MigrationInterface, QueryRunner } from "typeorm";

export class HubPoolProcessedBlock1720909029359 implements MigrationInterface {
    name = 'HubPoolProcessedBlock1720909029359';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "hub_pool_processed_block" ("id" SERIAL NOT NULL, "chainId" integer NOT NULL, "latestBlock" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5ee19e9910bd8cac851b865d51a" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "hub_pool_processed_block"`);
    }

}
