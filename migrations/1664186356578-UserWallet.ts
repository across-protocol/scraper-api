import { MigrationInterface, QueryRunner } from "typeorm";

export class UserWallet1664186356578 implements MigrationInterface {
  name = "UserWallet1664186356578";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_wallet" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "walletAddress" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UK_userWallet_userId" UNIQUE ("userId"), CONSTRAINT "UK_userWallet_walletAddress" UNIQUE ("walletAddress"), CONSTRAINT "REL_f470cbcba8c6dbdaf32ac0d426" UNIQUE ("userId"), CONSTRAINT "PK_b453ec3d9d579f6b9699be98beb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_wallet" ADD CONSTRAINT "FK_f470cbcba8c6dbdaf32ac0d4267" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_wallet" DROP CONSTRAINT "FK_f470cbcba8c6dbdaf32ac0d4267"`);
    await queryRunner.query(`DROP TABLE "user_wallet"`);
  }
}
