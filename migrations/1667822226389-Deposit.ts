import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1667822226389 implements MigrationInterface {
  name = "Deposit1667822226389";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "rewardsWindowIndex" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "rewardsWindowIndex"`);
  }
}
