import { MigrationInterface, QueryRunner } from "typeorm";

export class Wallet1663773308937 implements MigrationInterface {
  name = "Wallet1663773308937";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wallet" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "walletAddress" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_35472b1fe48b6330cd349709564" UNIQUE ("userId"), CONSTRAINT "UK_wallet_id_walletAddress" UNIQUE ("id", "walletAddress"), CONSTRAINT "REL_35472b1fe48b6330cd34970956" UNIQUE ("userId"), CONSTRAINT "PK_bec464dd8d54c39c54fd32e2334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet" ADD CONSTRAINT "FK_35472b1fe48b6330cd349709564" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet" DROP CONSTRAINT "FK_35472b1fe48b6330cd349709564"`);
    await queryRunner.query(`DROP TABLE "wallet"`);
  }
}
