import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1656424363536 implements MigrationInterface {
  name = "Deposit1656424363536";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deposit" ADD CONSTRAINT "UK_deposit_depositId_sourceChainId" UNIQUE ("depositId", "sourceChainId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP CONSTRAINT "UK_deposit_depositId_sourceChainId"`);
  }
}
