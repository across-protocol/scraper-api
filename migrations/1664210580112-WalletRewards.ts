import { MigrationInterface, QueryRunner } from "typeorm";

export class WalletRewards1664210580112 implements MigrationInterface {
  name = "WalletRewards1664210580112";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wallet_rewards" (
        "id" SERIAL NOT NULL, 
        "walletAddress" character varying NOT NULL, 
        "welcomeTravellerRewards" numeric NOT NULL, 
        "earlyUserRewards" numeric NOT NULL, 
        "liquidityProviderRewards" numeric NOT NULL, 
        "processed" boolean NOT NULL DEFAULT true, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_wallet_rewards_walletAddress" UNIQUE ("walletAddress"), 
        CONSTRAINT "PK_35794b255a8e427f320dd3baded" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IX_wallet_rewards_walletAddress" ON "wallet_rewards" ("walletAddress")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IX_wallet_rewards_walletAddress"`);
    await queryRunner.query(`DROP TABLE "wallet_rewards"`);
  }
}
