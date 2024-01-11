import { MigrationInterface, QueryRunner } from "typeorm";

export class OpReward1704793054934 implements MigrationInterface {
  name = "OpReward1704793054934";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "op_reward" ADD "windowIndex" integer`);
    await queryRunner.query(`ALTER TABLE "op_reward" ADD "isClaimed" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "op_reward" DROP COLUMN "isClaimed"`);
    await queryRunner.query(`ALTER TABLE "op_reward" DROP COLUMN "windowIndex"`);
  }
}
