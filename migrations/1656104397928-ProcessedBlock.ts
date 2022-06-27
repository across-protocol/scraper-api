import { MigrationInterface, QueryRunner } from "typeorm";

export class ProcessedBlock1656104397928 implements MigrationInterface {
  name = "ProcessedBlock1656104397928";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "processed_block" (
        "id" SERIAL NOT NULL, 
        "latestBlock" integer NOT NULL, 
        "chainId" integer NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_cff32a8a34109807f716b872987" PRIMARY KEY ("id")
    )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "processed_block"`);
  }
}
