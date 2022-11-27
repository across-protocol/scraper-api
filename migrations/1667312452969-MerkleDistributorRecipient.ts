import { MigrationInterface, QueryRunner } from "typeorm";

export class MerkleDistributorRecipient1667312452969 implements MigrationInterface {
  name = "MerkleDistributorRecipient1667312452969";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_recipient"
        DROP CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_addre"
    `);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_recipient"
        ADD CONSTRAINT "UK_merkle_distributor_recipient_windowId_address"
          UNIQUE ("merkleDistributorWindowId", "address")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_recipient"
        DROP CONSTRAINT "UK_merkle_distributor_recipient_windowId_address"
    `);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_recipient"
        ADD CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_addre"
          UNIQUE ("merkleDistributorWindowId", "address")
    `);
  }
}
