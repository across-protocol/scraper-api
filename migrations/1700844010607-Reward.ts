import { MigrationInterface, QueryRunner } from "typeorm";

export class Reward1700844010607 implements MigrationInterface {
  name = "Reward1700844010607";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reward" ADD "depositDate" TIMESTAMP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ALTER COLUMN "depositRelayerFeePct" DROP NOT NULL`);
  }
}
