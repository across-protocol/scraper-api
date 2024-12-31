import { MigrationInterface, QueryRunner } from "typeorm";

export class OpRewardV21735659642491 implements MigrationInterface {
    name = 'OpRewardV21735659642491';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "op_reward_v2" (
            "id" SERIAL NOT NULL,
            "depositId" integer NOT NULL,
            "originChainId" integer NOT NULL,
            "depositDate" TIMESTAMP NOT NULL,
            "recipient" character varying NOT NULL,
            "rate" numeric NOT NULL,
            "amount" character varying NOT NULL,
            "amountUsd" character varying NOT NULL,
            "rewardTokenId" integer NOT NULL,
            "windowIndex" integer,
            "isClaimed" boolean NOT NULL DEFAULT false,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "UK_opRewardV2_recipient_depId_chainId" UNIQUE ("recipient", "depositId", "originChainId"),
            CONSTRAINT "REL_f057b9c78adeb22f4f4fb69ea8" UNIQUE ("depositId", "originChainId"),
            CONSTRAINT "PK_fc4c022f3de3d4170ae8200c76b" PRIMARY KEY ("id"))
            `,
        );
        await queryRunner.query(`CREATE INDEX "IX_op_reward_v2_recipient" ON "op_reward_v2" ("recipient") `);
        await queryRunner.query(`ALTER TABLE "op_reward_v2" ADD CONSTRAINT "FK_op_reward_deposit" FOREIGN KEY ("depositId", "originChainId") REFERENCES "rewarded_deposit"("depositId","originChainId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "op_reward_v2" ADD CONSTRAINT "FK_op_reward_token" FOREIGN KEY ("rewardTokenId") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "op_reward_v2" DROP CONSTRAINT "FK_op_reward_token"`);
        await queryRunner.query(`ALTER TABLE "op_reward_v2" DROP CONSTRAINT "FK_op_reward_deposit"`);
        await queryRunner.query(`DROP INDEX "public"."IX_op_reward_v2_recipient"`);
        await queryRunner.query(`DROP TABLE "op_reward_v2"`);
    }

}
