import { MigrationInterface, QueryRunner } from "typeorm";

export class OpReward1703857703761 implements MigrationInterface {
  name = "OpReward1703857703761";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reward" RENAME TO "op_reward";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "op_reward" RENAME TO "reward";`);
  }
}
