import { MigrationInterface, QueryRunner } from "typeorm";

export class Block1656067512611 implements MigrationInterface {
  name = "Block1656067512611";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "block" (
        "id" SERIAL NOT NULL, 
        "blockNumber" integer NOT NULL,
        "chainId" integer NOT NULL, 
        "date" TIMESTAMP NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UK_block_blockNumber_chainId" UNIQUE ("blockNumber", "chainId"), 
        CONSTRAINT "PK_d0925763efb591c2e2ffb267572" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "block"`);
  }
}
