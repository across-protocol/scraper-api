import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositGapCheck1711039047259 implements MigrationInterface {
  name = "DepositGapCheck1711039047259";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "deposit_gap_check" (
        "originChainId" integer NOT NULL, 
        "depositId" integer NOT NULL, 
        "passed" boolean NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_62655590811df1ec582a1f32f99" PRIMARY KEY ("originChainId", "depositId"))
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deposit_gap_check"`);
  }
}
