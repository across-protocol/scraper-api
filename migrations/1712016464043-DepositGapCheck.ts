import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositGapCheck1712016464043 implements MigrationInterface {
  name = "DepositGapCheck1712016464043";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deposit_gap_check" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "deposit_gap_check" DROP CONSTRAINT "PK_62655590811df1ec582a1f32f99"
    `);
    await queryRunner.query(`
      ALTER TABLE "deposit_gap_check" ADD CONSTRAINT "PK_7aa323633a8bcf6e2402f9eff7a" PRIMARY KEY ("originChainId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "deposit_gap_check" DROP CONSTRAINT "PK_7aa323633a8bcf6e2402f9eff7a"
    `);
    await queryRunner.query(`
      ALTER TABLE "deposit_gap_check" ADD CONSTRAINT "PK_62655590811df1ec582a1f32f99" PRIMARY KEY ("originChainId", "depositId")
    `);
    await queryRunner.query(`ALTER TABLE "deposit_gap_check" DROP COLUMN "updatedAt"`);
  }
}
