import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositsMaterializedView1668007817974 implements MigrationInterface {
  name = "DepositsMaterializedView1668007817974";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "deposits_mv"`);
    await queryRunner.query(`DROP VIEW IF EXISTS "deposit_referral_stats"`);
    await queryRunner.query(`DROP VIEW IF EXISTS "deposits_filtered_referrals"`);
    await queryRunner.query(`CREATE VIEW "deposits_filtered_referrals" AS 
      SELECT 
        d.id,
        d."stickyReferralAddress",
        d."depositDate",
        d."priceId",
        d."tokenId",
        d.amount,
        d."depositorAddr",
        case when d."rewardsWindowIndex" = c."windowIndex" then d."rewardsWindowIndex" else -1 end as "claimedWindowIndex",
        hmp."usd",
        t.decimals
      FROM deposit d
      JOIN historic_market_price hmp on d."priceId" = hmp.id
      JOIN token t on d."tokenId" = t.id
      LEFT JOIN claim c on d."rewardsWindowIndex" = c."windowIndex" and d."referralAddress" = c."account"
      WHERE "stickyReferralAddress" is not null
        AND "depositDate" is not null
        AND "tokenId" is not null
        AND "priceId" is not null
        AND status = 'filled';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW "deposits_mv"`);
    await queryRunner.query(`DROP VIEW "deposit_referral_stats"`);
    await queryRunner.query(`DROP VIEW "deposits_filtered_referrals"`);
  }
}
