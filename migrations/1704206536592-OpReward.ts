import { MigrationInterface, QueryRunner } from "typeorm";

export class OpReward1704206536592 implements MigrationInterface {
  name = "OpReward1704206536592";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "op_reward" DROP CONSTRAINT "FK_3394b66a9dd131d6af3c75b2547"`);
    await queryRunner.query(`ALTER TABLE "op_reward" DROP CONSTRAINT "FK_b7d52ca0455c480aaf8030b779c"`);
    await queryRunner.query(`
          ALTER TABLE "op_reward" 
            ADD CONSTRAINT "FK_op_reward_deposit" 
              FOREIGN KEY ("depositPrimaryKey") 
              REFERENCES "deposit"("id") 
              ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
        ALTER TABLE "op_reward" 
          ADD CONSTRAINT "FK_op_reward_token" 
            FOREIGN KEY ("rewardTokenId") 
            REFERENCES "token"("id") 
            ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "op_reward" DROP CONSTRAINT "FK_op_reward_token"`);
    await queryRunner.query(`ALTER TABLE "op_reward" DROP CONSTRAINT "FK_op_reward_deposit"`);
    await queryRunner.query(`
      ALTER TABLE "op_reward" 
        ADD CONSTRAINT "FK_b7d52ca0455c480aaf8030b779c" 
          FOREIGN KEY ("rewardTokenId") 
          REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "op_reward" 
        ADD CONSTRAINT "FK_3394b66a9dd131d6af3c75b2547" 
          FOREIGN KEY ("depositPrimaryKey") 
          REFERENCES "deposit"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }
}
