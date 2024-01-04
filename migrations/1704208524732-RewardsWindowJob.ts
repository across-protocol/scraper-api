import { MigrationInterface, QueryRunner } from "typeorm";

export class RewardsWindowJob1704208524732 implements MigrationInterface {
  name = "RewardsWindowJob1704208524732";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "referral_rewards_window_job" RENAME TO "rewards_window_job";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rewards_window_job" RENAME TO "referral_rewards_window_job";`);
  }
}
