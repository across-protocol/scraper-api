import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositReferraInfo1736706626172 implements MigrationInterface {
  name = "DepositReferraInfo1736706626172";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create table deposit_referral_info
        as select * from deposits_mv
        with no data;
      `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UK_dri_depositId_sourceChainId"
        ON deposit_referral_info ("depositId", "sourceChainId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UK_dri_depositId_sourceChainId"`);
    await queryRunner.query(`DROP TABLE "deposit_referral_info"`);
  }
}
