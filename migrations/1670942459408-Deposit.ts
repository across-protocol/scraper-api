import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1670942459408 implements MigrationInterface {
  name = "Deposit1670942459408";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ALTER COLUMN "suggestedRelayerFeePct" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "deposit" ALTER COLUMN "suggestedRelayerFeePct" SET DEFAULT '100000000000000'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "deposit" ALTER COLUMN "suggestedRelayerFeePct" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "deposit" ALTER COLUMN "suggestedRelayerFeePct" DROP NOT NULL`);
  }
}
