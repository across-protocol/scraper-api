import { MigrationInterface, QueryRunner } from "typeorm";

export class RewardsWindowJob1704208524733 implements MigrationInterface {
  name = "RewardsWindowJob1704208524733";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER SEQUENCE "referral_rewards_window_job_id_seq" RENAME TO "rewards_window_job_id_seq";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER SEQUENCE "referral_rewards_window_job_id_seq" RENAME TO "rewards_window_job_id_seq";
    `);
  }
}
