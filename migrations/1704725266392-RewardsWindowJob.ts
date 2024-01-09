import { MigrationInterface, QueryRunner } from "typeorm";

export class RewardsWindowJob1704725266392 implements MigrationInterface {
  name = "RewardsWindowJob1704725266392";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rewards_window_job" ADD "rewardsType" character varying NOT NULL DEFAULT 'referral-rewards'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rewards_window_job" DROP COLUMN "rewardsType"`);
  }
}
