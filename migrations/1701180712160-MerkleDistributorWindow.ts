import { MigrationInterface, QueryRunner } from "typeorm";

export class MerkleDistributorWindow1701180712160 implements MigrationInterface {
  name = "MerkleDistributorWindow1701180712160";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_window" ADD "contractAddress" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_window" 
      DROP CONSTRAINT "UK_merkle_distributor_window_windowIndex"
    `);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_window" 
      ADD CONSTRAINT "UK_mdw_chainId_contractAddress_windowIndex" 
        UNIQUE ("chainId", "contractAddress", "windowIndex")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_window" 
      DROP CONSTRAINT "UK_mdw_chainId_contractAddress_windowIndex"
    `);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_window" 
      ADD CONSTRAINT "UK_merkle_distributor_window_windowIndex" UNIQUE ("windowIndex")
    `);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_window" 
      DROP COLUMN "contractAddress"
    `);
  }
}
