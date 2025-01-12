import { MigrationInterface, QueryRunner } from "typeorm";

export class OpRewardsStats1736706626171 implements MigrationInterface {
  name = "OpRewardsStats1736706626171";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "op_rewards_stats" (
        "id" integer NOT NULL, 
        "totalTokenAmount" numeric NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_489a963c1c293a7be951b09b793" PRIMARY KEY ("id"))
      `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "op_rewards_stats"`);
  }
}
