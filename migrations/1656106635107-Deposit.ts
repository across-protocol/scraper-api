import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1656106635107 implements MigrationInterface {
  name = "Deposit1656106635107";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "deposit" (
            "id" SERIAL NOT NULL, 
            "depositId" integer NOT NULL, 
            "sourceChainId" integer NOT NULL, 
            "destinationChainId" integer NOT NULL, 
            "amount" numeric NOT NULL, 
            "filled" numeric NOT NULL DEFAULT '0', 
            "status" character varying NOT NULL DEFAULT 'pending', 
            "depositorAddr" character varying NOT NULL, 
            "depositDate" TIMESTAMP, 
            "tokenAddr" character varying NOT NULL, 
            "depositTxHash" character varying NOT NULL, 
            "fillTxs" jsonb NOT NULL DEFAULT '[]',
            "realizedLpFeePct" numeric NOT NULL DEFAULT '0',
            "blockNumber" integer NOT NULL, 
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
            CONSTRAINT "PK_6654b4be449dadfd9d03a324b61" PRIMARY KEY ("id")
        )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deposit"`);
  }
}
