import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1738754833757 implements MigrationInterface {
  name = "Deposit1738754833757";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deposit" ALTER COLUMN "depositId" type numeric using "depositId"::numeric`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deposit" ALTER COLUMN "depositId" type integer using "depositId"::integer`,
    );
  }
}
