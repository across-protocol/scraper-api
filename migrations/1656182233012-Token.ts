import { MigrationInterface, QueryRunner } from "typeorm";

export class Token1656182233012 implements MigrationInterface {
  name = "Token1656182233012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "token" (
        "id" SERIAL NOT NULL, 
        "address" character varying NOT NULL, 
        "chainId" integer NOT NULL, 
        "name" character varying NOT NULL, 
        "symbol" character varying NOT NULL, 
        "decimals" integer NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_token_address_chainId" UNIQUE ("address", "chainId"), 
        CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`ALTER TABLE "deposit" ADD "tokenId" integer`);
    await queryRunner.query(
      `ALTER TABLE "deposit" 
        ADD CONSTRAINT "FK_04bd2ce318dfbe2bdbf2b76dbe0" 
          FOREIGN KEY ("tokenId") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP CONSTRAINT "FK_04bd2ce318dfbe2bdbf2b76dbe0"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "tokenId"`);
    await queryRunner.query(`DROP TABLE "token"`);
  }
}
