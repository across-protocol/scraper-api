import { MigrationInterface, QueryRunner } from "typeorm";

export class ReferralRewardsWindowJob1696942295195 implements MigrationInterface {
  name = "ReferralRewardsWindowJob1696942295195";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "referral_rewards_window_job" (
        "id" SERIAL NOT NULL, 
        "windowIndex" integer NOT NULL, 
        "status" character varying NOT NULL DEFAULT 'Initial', 
        "config" jsonb NOT NULL, 
        "error" character varying, 
        "executionTime" numeric, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_c6fec40b7e4d76f0be188c6a8c4" PRIMARY KEY ("id")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referral_rewards_window_job"`);
  }
}
