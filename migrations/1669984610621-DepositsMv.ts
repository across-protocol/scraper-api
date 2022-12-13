import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositsMv1669984610621 implements MigrationInterface {
  name = "DepositsMv1669984610621";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "deposits_mv"`);
    await queryRunner.query(`CREATE MATERIALIZED VIEW "deposits_mv" AS 
      SELECT
        d.id,
        d."depositId",
        d."depositTxHash",
        d."sourceChainId",
        d."destinationChainId",
        d.amount,
        t.symbol,
        t.decimals,
        d."depositorAddr",
        d."rewardsWindowIndex",
        case when d."rewardsWindowIndex" = c."windowIndex" and d."depositorAddr" = c.account then d."rewardsWindowIndex" else -1 end as "depositorClaimedWindowIndex",
        d1."referralClaimedWindowIndex",
        d."stickyReferralAddress" AS "referralAddress",
        d."depositDate",
        hmp.usd AS "tokenUsdPrice",
        (d."realizedLpFeePctCapped" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd AS "realizedLpFeeUsd",
        (d."bridgeFeePct" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd AS "bridgeFeeUsd",
        d."acxUsdPrice",
      CASE
        WHEN d1."referralCount" >= 20 OR d1."referralVolume" >= 500000 THEN 0.8
        WHEN d1."referralCount" >= 10 OR d1."referralVolume" >= 250000 THEN 0.7
        WHEN d1."referralCount" >= 5 OR d1."referralVolume" >= 100000 THEN 0.6
        WHEN d1."referralCount" >= 3 OR d1."referralVolume" >= 50000 THEN 0.5
        ELSE 0.4
      END AS "referralRate",
      CASE
          WHEN d."depositDate" < '2022-07-22 17:00:00' THEN 3
          WHEN d."depositDate" < '2022-12-13 00:00:00' THEN 2
          ELSE 1
      END AS multiplier
      FROM deposit d
      JOIN "deposit_referral_stat" d1 ON d."id" = d1."depositId"
      JOIN token t ON d."tokenId" = t.id
      JOIN historic_market_price hmp ON d."priceId" = hmp.id
      LEFT JOIN claim c on d."rewardsWindowIndex" = c."windowIndex" and c.account = d."depositorAddr"
      ORDER BY d."depositDate" desc;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UK_deposits_mv_depositId_sourceChainId" ON deposits_mv ("depositId", "sourceChainId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW "deposits_mv"`);
  }
}
