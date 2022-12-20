import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1671299400000 implements MigrationInterface {
  name = "Deposit1671299400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      create index "IX_deposit_srAddress_depositDate_pId_tId_status" 
        on deposit ("stickyReferralAddress", "depositDate", "priceId", "tokenId", status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop index if exists "IX_deposit_srAddress_depositDate_pId_tId_status"`);
  }
}
