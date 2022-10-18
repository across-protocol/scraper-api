import { MigrationInterface, QueryRunner } from "typeorm";

export class MerkleDistributorRecipient1666019035196 implements MigrationInterface {
  name = "MerkleDistributorRecipient1666019035196";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merkle_distributor_recipient" (
        "id" SERIAL NOT NULL, 
        "merkleDistributorWindowId" integer NOT NULL, 
        "address" character varying NOT NULL, 
        "amount" numeric NOT NULL, 
        "accountIndex" integer NOT NULL, 
        "proof" jsonb NOT NULL, 
        "payload" jsonb NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_address" UNIQUE ("merkleDistributorWindowId", "address"), 
        CONSTRAINT "PK_4e2e34ff4eb70d9debea9693f78" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_recipient" 
      ADD CONSTRAINT "FK_0074cbd24d2a7f96158633c4534" 
        FOREIGN KEY ("merkleDistributorWindowId") 
        REFERENCES "merkle_distributor_window"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "merkle_distributor_recipient" 
      DROP CONSTRAINT "FK_0074cbd24d2a7f96158633c4534"
    `);
    await queryRunner.query(`DROP TABLE "merkle_distributor_recipient"`);
  }
}
