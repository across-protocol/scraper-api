import { MigrationInterface, QueryRunner } from "typeorm";

export class OpReward1704208524731 implements MigrationInterface {
  name = "OpReward1704208524731";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IX_reward_recipient_type"`);
    await queryRunner.query(`ALTER TABLE "op_reward" DROP CONSTRAINT "UK_reward_recipient_type_depositPk"`);
    await queryRunner.query(`ALTER TABLE "op_reward" DROP COLUMN "type"`);
    await queryRunner.query(`CREATE INDEX "IX_op_reward_recipient" ON "op_reward" ("recipient") `);
    await queryRunner.query(`
      ALTER TABLE "op_reward" 
        ADD CONSTRAINT "UK_op_reward_recipient_depositPk" 
          UNIQUE ("recipient", "depositPrimaryKey")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "op_reward" DROP CONSTRAINT "UK_op_reward_recipient_depositPk"`);
    await queryRunner.query(`DROP INDEX "public"."IX_op_reward_recipient"`);
    await queryRunner.query(`ALTER TABLE "op_reward" ADD "type" character varying NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "op_reward" 
        ADD CONSTRAINT "UK_reward_recipient_type_depositPk" 
          UNIQUE ("depositPrimaryKey", "recipient", "type")
    `);
    await queryRunner.query(`CREATE INDEX "IX_reward_recipient_type" ON "op_reward" ("recipient", "type") `);
  }
}
