import { MigrationInterface, QueryRunner } from "typeorm";

export class Reward1700668522650 implements MigrationInterface {
  name = "Reward1700668522650";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reward" ADD "claimedWindowIndex" integer NOT NULL DEFAULT '-1'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reward" DROP COLUMN "claimedWindowIndex"`);
  }
}
