import { MigrationInterface, QueryRunner } from "typeorm";

export class ArbReward1718123954440 implements MigrationInterface {
  name = "ArbReward1718123954440";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "arb_reward" (
      "id" SERIAL NOT NULL, 
      "depositPrimaryKey" integer NOT NULL, 
      "depositDate" TIMESTAMP NOT NULL, 
      "recipient" character varying NOT NULL, 
      "metadata" jsonb NOT NULL, 
      "amount" character varying NOT NULL, 
      "amountUsd" character varying NOT NULL, 
      "rewardTokenId" integer NOT NULL, 
      "windowIndex" integer, 
      "isClaimed" boolean NOT NULL DEFAULT false, 
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
      CONSTRAINT "UK_arb_reward_depositPk" UNIQUE ("depositPrimaryKey"), 
      CONSTRAINT "PK_15ab2d5f32f73347e21725b9d59" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`
      CREATE INDEX "IX_arb_reward_recipient_depositDate" ON "arb_reward" ("recipient", "depositDate")
    `);
    await queryRunner.query(`
      ALTER TABLE "arb_reward" 
      ADD CONSTRAINT "FK_arb_reward_deposit" 
      FOREIGN KEY ("depositPrimaryKey") REFERENCES "deposit"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "arb_reward" 
      ADD CONSTRAINT "FK_arb_reward_token" 
      FOREIGN KEY ("rewardTokenId") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "arb_reward" DROP CONSTRAINT "FK_arb_reward_token"`);
    await queryRunner.query(`ALTER TABLE "arb_reward" DROP CONSTRAINT "FK_arb_reward_deposit"`);
    await queryRunner.query(`DROP INDEX "public"."IX_arb_reward_recipient_depositDate"`);
    await queryRunner.query(`DROP TABLE "arb_reward"`);
  }
}
