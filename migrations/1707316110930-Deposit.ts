import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1707316110930 implements MigrationInterface {
  name = "Deposit1707316110930";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ADD "outputAmount" numeric`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "outputTokenAddress" character varying`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "outputTokenId" integer`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "outputTokenPriceId" integer`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "fillDeadline" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "exclusivityDeadline" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "deposit" ADD "relayer" character varying`);
    await queryRunner.query(`
      ALTER TABLE "deposit" 
        ADD CONSTRAINT "FK_deposit_outputTokenId" 
          FOREIGN KEY ("tokenId") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "deposit" 
        ADD CONSTRAINT "FK_deposit_outputTokenPriceId" 
          FOREIGN KEY ("outputTokenPriceId") REFERENCES "historic_market_price"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" DROP CONSTRAINT "FK_deposit_outputTokenPriceId"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP CONSTRAINT "FK_deposit_outputTokenId"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "relayer"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "exclusivityDeadline"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "fillDeadline"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "outputTokenPriceId"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "outputTokenId"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "outputTokenAddress"`);
    await queryRunner.query(`ALTER TABLE "deposit" DROP COLUMN "outputAmount"`);
  }
}
