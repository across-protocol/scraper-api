import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositReferralStat1668339782207 implements MigrationInterface {
  name = "DepositReferralStat1668339782207";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "deposit_referral_stat" (
        "id" SERIAL NOT NULL, 
        "depositId" integer NOT NULL, 
        "referralCount" integer NOT NULL, 
        "referralVolume" numeric NOT NULL, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_74ce2ecc7d76a2e59039e94fcfc" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UK_drs_depositId" ON deposit_referral_stat ("depositId");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "deposit_referral_stat"`);
  }
}
