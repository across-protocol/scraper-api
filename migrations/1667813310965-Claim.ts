import { MigrationInterface, QueryRunner } from "typeorm";

export class Claim1667813310965 implements MigrationInterface {
  name = "Claim1667813310965";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "claim" (
        "id" SERIAL NOT NULL,
        "caller" character varying NOT NULL,
        "accountIndex" integer NOT NULL,
        "windowIndex" integer NOT NULL,
        "account" character varying NOT NULL,
        "rewardToken" character varying NOT NULL,
        "blockNumber" integer NOT NULL,
        "claimedAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "merkleDistributorWindowId" integer,
        CONSTRAINT "UK_claim_windowIndex_accountIndex" UNIQUE (
          "windowIndex",
          "accountIndex"
        ),
        CONSTRAINT "PK_466b305cc2e591047fa1ce58f81" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`CREATE INDEX "IX_claim_account" ON "claim" ("account")`);
    await queryRunner.query(`
      ALTER TABLE "claim"
        ADD CONSTRAINT "FK_169ca2a2e031f01f62d81dbf1a0"
          FOREIGN KEY ("merkleDistributorWindowId")
          REFERENCES "merkle_distributor_window"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "claim" DROP CONSTRAINT "FK_169ca2a2e031f01f62d81dbf1a0"
    `);
    await queryRunner.query(`DROP TABLE "merkle_distributor_processed_block"`);
    await queryRunner.query(`DROP INDEX "public"."IX_claim_account"`);
    await queryRunner.query(`DROP TABLE "claim"`);
  }
}
