import { MigrationInterface, QueryRunner } from "typeorm";

export class CommunityRewards1664210580112 implements MigrationInterface {
  name = "CommunityRewards1664210580112";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "community_rewards" (
            "id" SERIAL NOT NULL, 
        "discordId" character varying NOT NULL, 
        "amount" numeric NOT NULL, 
        "processed" boolean NOT NULL DEFAULT true, 
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(), 
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), 
        CONSTRAINT "UK_community_rewards_discordId" UNIQUE ("discordId"), 
        CONSTRAINT "PK_8a9bde213ca3fea572c33d8fd9e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IX_community_rewards_discordId" ON "community_rewards" ("discordId") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IX_community_rewards_discordId"`);
    await queryRunner.query(`DROP TABLE "community_rewards"`);
  }
}
