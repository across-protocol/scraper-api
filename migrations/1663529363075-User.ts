import { MigrationInterface, QueryRunner } from "typeorm";

export class User1663529363075 implements MigrationInterface {
  name = "User1663529363075";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "user" (
      "id" SERIAL NOT NULL, 
      "shortId" character varying NOT NULL, 
      "uuid" character varying NOT NULL, 
      "discordId" character varying, 
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
      CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "depositRelayerFeePct" numeric NOT NULL DEFAULT '0'`);
  }
}
