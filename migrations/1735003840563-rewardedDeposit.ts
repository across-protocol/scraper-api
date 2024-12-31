import { MigrationInterface, QueryRunner } from "typeorm";

export class RewardedDeposit1735003840563 implements MigrationInterface {
    name = 'RewardedDeposit1735003840563';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE "rewarded_deposit" (
            "id" SERIAL NOT NULL,
            "relayHash" character varying NOT NULL,
            "depositTxHash" character varying NOT NULL,
            "depositId" integer NOT NULL,
            "originChainId" integer NOT NULL,
            "destinationChainId" integer NOT NULL,
            "depositor" character varying NOT NULL,
            "recipient" character varying NOT NULL,
            "inputToken" character varying NOT NULL,
            "inputAmount" character varying NOT NULL,
            "outputToken" character varying NOT NULL,
            "outputAmount" character varying NOT NULL,
            "exclusiveRelayer" character varying NOT NULL,
            "depositDate" TIMESTAMP NOT NULL,
            "fillTxHash" character varying NOT NULL,
            "relayer" character varying NOT NULL,
            "totalBridgeFeeUsd" character varying NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "UK_rewardedDeposit_depositId_originChainId" UNIQUE ("depositId", "originChainId"),
            CONSTRAINT "PK_891e96cd023b61f620566c0898a" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "rewarded_deposit"`);
    }

}
