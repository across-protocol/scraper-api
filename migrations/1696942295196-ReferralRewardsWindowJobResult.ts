import { MigrationInterface, QueryRunner } from "typeorm";

export class ReferralRewardsWindowJobResult1696942295196 implements MigrationInterface {
  name = "ReferralRewardsWindowJobResult1696942295196";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "referral_rewards_window_job_result" (
        "id" SERIAL NOT NULL, 
        "jobId" integer NOT NULL, 
        "windowIndex" integer NOT NULL, 
        "totalRewardsAmount" numeric NOT NULL, 
        "address" character varying NOT NULL, 
        "amount" numeric NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_5f25c5ee5b67b2a5c403fde9168" PRIMARY KEY ("id"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "referral_rewards_window_job_result"`);
  }
}
