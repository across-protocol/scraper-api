import { MigrationInterface, QueryRunner } from "typeorm";

export class User1663940982693 implements MigrationInterface {
  name = "User1663940982693";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "discordName" character varying`);
    await queryRunner.query(`ALTER TABLE "user" ADD "discordAvatar" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "discordAvatar"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "discordName"`);
  }
}
