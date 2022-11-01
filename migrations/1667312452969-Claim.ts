import { MigrationInterface, QueryRunner } from "typeorm";

export class Claim1667312452969 implements MigrationInterface {
  name = "Claim1667312452969";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" DROP CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_addre"`,
    );
    await queryRunner.query(
      `CREATE TABLE "claim" ("id" SERIAL NOT NULL, "caller" character varying NOT NULL, "accountIndex" integer NOT NULL, "windowIndex" integer NOT NULL, "account" character varying NOT NULL, "rewardToken" character varying NOT NULL, "blockNumber" integer NOT NULL, "claimedAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UK_claim_windowIndex_accountIndex" UNIQUE ("windowIndex", "accountIndex"), CONSTRAINT "PK_466b305cc2e591047fa1ce58f81" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IX_claim_account" ON "claim" ("account") `);
    await queryRunner.query(
      `CREATE TABLE "merkle_distributor_processed_block" ("id" SERIAL NOT NULL, "chainId" integer NOT NULL, "latestBlock" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fb2eb512abaadb453e1cfef109e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" ADD CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_address" UNIQUE ("merkleDistributorWindowId", "address")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" DROP CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_address"`,
    );
    await queryRunner.query(`DROP TABLE "merkle_distributor_processed_block"`);
    await queryRunner.query(`DROP INDEX "public"."IX_claim_account"`);
    await queryRunner.query(`DROP TABLE "claim"`);
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" ADD CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_addre" UNIQUE ("merkleDistributorWindowId", "address")`,
    );
  }
}
