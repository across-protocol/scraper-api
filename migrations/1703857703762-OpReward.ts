import { MigrationInterface, QueryRunner } from "typeorm";

export class OpReward1703857703762 implements MigrationInterface {
  name = "OpReward1703857703762";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER SEQUENCE "reward_id_seq" RENAME TO "op_reward_id_seq";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER SEQUENCE "op_reward_id_seq" RENAME TO "reward_id_seq";`);
  }
}
