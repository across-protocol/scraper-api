import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1714647751484 implements MigrationInterface {
  name = "Deposit1714647751484";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "swapTokenAddress" character varying`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "swapTokenId" integer`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "swapTokenAmount" numeric`);
    await queryRunner.query(`
      ALTER TABLE "deposit" 
      ADD CONSTRAINT "FK_deposit_swapTokenId" 
        FOREIGN KEY ("swapTokenId") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP CONSTRAINT "FK_deposit_swapTokenId"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "swapTokenAmount"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "swapTokenId"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "swapTokenAddress"`);
  }
}
