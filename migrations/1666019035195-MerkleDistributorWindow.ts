import { MigrationInterface, QueryRunner } from "typeorm";

export class MerkleDistributorWindow1666019035195 implements MigrationInterface {
  name = "MerkleDistributorWindow1666019035195";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "merkle_distributor_window" (
        "id" SERIAL NOT NULL, 
        "chainId" integer NOT NULL, 
        "rewardToken" character varying NOT NULL, 
        "windowIndex" integer NOT NULL, 
        "rewardsToDeposit" numeric NOT NULL, 
        "merkleRoot" character varying NOT NULL, 
        "ipfsHash" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_merkle_distributor_window_windowIndex" UNIQUE ("windowIndex"), 
        CONSTRAINT "PK_243dd06d9b7183bd8700e92129d" PRIMARY KEY ("id")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "merkle_distributor_window"`);
  }
}
