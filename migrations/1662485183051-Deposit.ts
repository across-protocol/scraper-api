import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1662485183051 implements MigrationInterface {
  name = "Deposit1662485183051";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "IX_deposit_depositorAddr" ON "deposit" ("depositorAddr") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IX_deposit_depositorAddr"`);
  }
}
