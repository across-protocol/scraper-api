import { MigrationInterface, QueryRunner } from "typeorm";

export class MerkleDistributorClaim1704887455012 implements MigrationInterface {
  name = "MerkleDistributorClaim1704887455012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merkle_distributor_claim" (
        "id" SERIAL NOT NULL, 
        "caller" character varying NOT NULL, 
        "accountIndex" integer NOT NULL, 
        "windowIndex" integer NOT NULL, 
        "account" character varying NOT NULL, 
        "rewardToken" character varying NOT NULL, 
        "blockNumber" integer NOT NULL, 
        "contractAddress" character varying NOT NULL, 
        "claimedAt" TIMESTAMP NOT NULL, 
        "merkleDistributorWindowId" integer NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_mdc_mdWindowId_account" UNIQUE ("merkleDistributorWindowId", "account"), 
        CONSTRAINT "PK_c110f5b9dc4fe7ec581c9b5f09a" PRIMARY KEY ("id"))
    `);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_claim" 
        ADD CONSTRAINT "FK_mdc_window" 
          FOREIGN KEY ("merkleDistributorWindowId") 
          REFERENCES "merkle_distributor_window"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "merkle_distributor_claim" DROP CONSTRAINT "FK_mdc_window"`);
    await queryRunner.query(`DROP TABLE "merkle_distributor_claim"`);
  }
}
