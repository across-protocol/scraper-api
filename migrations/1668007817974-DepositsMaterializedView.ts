import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositsMaterializedView1668007817974 implements MigrationInterface {
  name = "DepositsMaterializedView1668007817974";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "deposits_mv"`);
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
        case when d."rewardsWindowIndex" = c."windowIndex" then d."rewardsWindowIndex" else -1 end as "claimedWindowIndex"
      FROM deposit d
      left join claim c on d."rewardsWindowIndex" = c."windowIndex" and d."referralAddress" = c."account"
      WHERE "stickyReferralAddress" is not null
        AND "depositDate" is not null
        AND "tokenId" is not null
        AND "priceId" is not null
        AND status = 'filled';
    `);

    await queryRunner.query(`DROP VIEW IF EXISTS "deposit_referral_stats"`);
    await queryRunner.query(`CREATE VIEW "deposit_referral_stats" AS 
      SELECT 
        d1.id,
        count(distinct d2."depositorAddr") as "referralCount",
        sum((d2.amount / power(10, t.decimals)) * hmp.usd) as "referralVolume"
      FROM deposits_filtered_referrals d1
      LEFT JOIN deposits_filtered_referrals d2 on d1."stickyReferralAddress" = d2."stickyReferralAddress" AND 
        d1."depositDate" >= d2."depositDate" AND 
        d1."claimedWindowIndex" = d2."claimedWindowIndex"
      JOIN historic_market_price hmp on d2."priceId" = hmp.id
      JOIN token t on d2."tokenId" = t.id
      GROUP BY d1.id
    `);

    await queryRunner.query(`CREATE MATERIALIZED VIEW "deposits_mv" AS 
      SELECT
        d."depositId",
        d."depositTxHash",
        d."sourceChainId",
        d."destinationChainId",
        d.amount,
        t.symbol,
        t.decimals,
        d."depositorAddr",
        d."rewardsWindowIndex",
        case when d."rewardsWindowIndex" = c."windowIndex" then d."rewardsWindowIndex" else -1 end as "claimedWindowIndex",
        d."stickyReferralAddress" AS "referralAddress",
        d."depositDate",
        hmp.usd AS "tokenUsdPrice",
        (d."realizedLpFeePctCapped" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd AS "realizedLpFeeUsd",
        (d."bridgeFeePct" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd AS "bridgeFeeUsd",
      CASE
        WHEN d1."referralCount" >= 20 OR d1."referralVolume" >= 500000 THEN 0.8
        WHEN d1."referralCount" >= 10 OR d1."referralVolume" >= 250000 THEN 0.7
        WHEN d1."referralCount" >= 5 OR d1."referralVolume" >= 100000 THEN 0.6
        WHEN d1."referralCount" >= 3 OR d1."referralVolume" >= 50000 THEN 0.5
        ELSE 0.4
      END AS "referralRate",
      CASE
          WHEN d."depositDate" < '2022-07-22 17:00:00' THEN 3
          ELSE 2
      END AS multiplier
      FROM deposit d
      JOIN "deposit_referral_stats" d1 ON d.id = d1.id
      JOIN token t ON d."tokenId" = t.id
      JOIN historic_market_price hmp ON d."priceId" = hmp.id
      LEFT JOIN claim c on d."rewardsWindowIndex" = c."windowIndex" and d."referralAddress" = c."account"
      ORDER BY d."depositDate" desc;
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UK_deposits_mv_depositId_sourceChainId" ON deposits_mv ("depositId", "sourceChainId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW "deposits_mv"`);
    await queryRunner.query(`DROP VIEW "deposit_referral_stats"`);
    await queryRunner.query(`DROP VIEW "deposits_filtered_referrals"`);
  }
}
