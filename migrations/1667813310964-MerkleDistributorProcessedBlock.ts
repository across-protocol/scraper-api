import { MigrationInterface, QueryRunner } from "typeorm";

export class MerkleDistributorProcessedBlock1667813310964 implements MigrationInterface {
  name = "MerkleDistributorProcessedBlock1667813310964";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merkle_distributor_processed_block" (
        "id" SERIAL NOT NULL,
        "chainId" integer NOT NULL,
        "latestBlock" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fb2eb512abaadb453e1cfef109e" PRIMARY KEY ("id"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "merkle_distributor_processed_block"`);
  }
}
