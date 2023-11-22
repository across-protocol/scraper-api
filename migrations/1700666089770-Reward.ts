import { MigrationInterface, QueryRunner } from "typeorm";

export class Reward1700666089770 implements MigrationInterface {
  name = "Reward1700666089770";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reward" (
        "id" SERIAL NOT NULL, "depositPrimaryKey" integer NOT NULL,
        "recipient" character varying NOT NULL,
        "type" character varying NOT NULL,
        "metadata" jsonb NOT NULL,
        "amount" character varying NOT NULL,
        "amountUsd" character varying NOT NULL,
        "rewardTokenId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UK_reward_recipient_type_depositPk" UNIQUE ("recipient", "type", "depositPrimaryKey"),
        CONSTRAINT "PK_a90ea606c229e380fb341838036" PRIMARY KEY ("id")
        )`,
    );
    await queryRunner.query(`CREATE INDEX "IX_reward_recipient_type" ON "reward" ("recipient", "type") `);

    await queryRunner.query(
      `ALTER TABLE "reward" ADD CONSTRAINT "FK_3394b66a9dd131d6af3c75b2547" FOREIGN KEY ("depositPrimaryKey") REFERENCES "deposit"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reward" ADD CONSTRAINT "FK_b7d52ca0455c480aaf8030b779c" FOREIGN KEY ("rewardTokenId") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reward" DROP CONSTRAINT "FK_b7d52ca0455c480aaf8030b779c"`);
    await queryRunner.query(`ALTER TABLE "reward" DROP CONSTRAINT "FK_3394b66a9dd131d6af3c75b2547"`);
    await queryRunner.query(`DROP INDEX "public"."IX_reward_recipient_type"`);
    await queryRunner.query(`DROP TABLE "reward"`);
  }
}
