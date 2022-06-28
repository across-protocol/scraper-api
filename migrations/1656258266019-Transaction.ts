import { MigrationInterface, QueryRunner } from "typeorm";

export class Transaction1656258266019 implements MigrationInterface {
  name = "Transaction1656258266019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "transaction" (
        "id" SERIAL NOT NULL, 
        "chainId" integer NOT NULL, 
        "hash" character varying NOT NULL, 
        "data" character varying NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_89eadb93a89810556e1cbcd6ab9" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "referralAddress" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "referralAddress"`);
    await queryRunner.query(`DROP TABLE "transaction"`);
  }
}
