import { MigrationInterface, QueryRunner } from "typeorm";

export class ReferralReward1720196508690 implements MigrationInterface {
    name = 'ReferralReward1720196508690'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          CREATE TABLE "referral_reward" (
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
            CONSTRAINT "PK_039e9361b7ea8c9a9e500ee6e1e" PRIMARY KEY ("id"))
        `);
        await queryRunner.query(`CREATE INDEX "IX_referral_reward_recipient" ON "referral_reward" ("recipient") `);
        await queryRunner.query(`CREATE INDEX "IX_referral_reward_depositPk" ON "referral_reward" ("depositPrimaryKey") `);
        await queryRunner.query(`ALTER TABLE "referral_reward" ADD CONSTRAINT "FK_referral_reward_deposit" FOREIGN KEY ("depositPrimaryKey") REFERENCES "deposit"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "referral_reward" ADD CONSTRAINT "FK_referral_reward_token" FOREIGN KEY ("rewardTokenId") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "referral_reward" DROP CONSTRAINT "FK_referral_reward_token"`);
        await queryRunner.query(`ALTER TABLE "referral_reward" DROP CONSTRAINT "FK_referral_reward_deposit"`);
        await queryRunner.query(`DROP INDEX "public"."IX_referral_reward_depositPk"`);
        await queryRunner.query(`DROP INDEX "public"."IX_referral_reward_recipient"`);
        await queryRunner.query(`DROP TABLE "referral_reward"`);
    }

}
