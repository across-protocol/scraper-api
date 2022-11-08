import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositsMv1667824679940 implements MigrationInterface {
  name = "DepositsMv1667824679940";

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      ORDER BY d."depositDate" desc;
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        "public",
        "MATERIALIZED_VIEW",
        "deposits_mv",
        'SELECT\n      d."depositId",\n      d."depositTxHash",\n      d."sourceChainId",\n      d."destinationChainId",\n      d.amount,\n      t.symbol,\n      t.decimals,\n      d."depositorAddr",\n      d."rewardsWindowIndex",\n      d."stickyReferralAddress" AS "referralAddress",\n      d."depositDate",\n      hmp.usd AS "tokenUsdPrice",\n      (d."realizedLpFeePctCapped" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd AS "realizedLpFeeUsd",\n      (d."bridgeFeePct" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd AS "bridgeFeeUsd",\n    CASE\n      WHEN d1."referralCount" >= 20 OR d1."referralVolume" >= 500000 THEN 0.8\n      WHEN d1."referralCount" >= 10 OR d1."referralVolume" >= 250000 THEN 0.7\n      WHEN d1."referralCount" >= 5 OR d1."referralVolume" >= 100000 THEN 0.6\n      WHEN d1."referralCount" >= 3 OR d1."referralVolume" >= 50000 THEN 0.5\n      ELSE 0.4\n    END AS "referralRate",\n    CASE\n        WHEN d."depositDate" < \'2022-07-22 17:00:00\' THEN 3\n        ELSE 2\n    END AS multiplier\n    FROM deposit d\n    JOIN "deposit_referral_stats" d1 ON d.id = d1.id\n    JOIN token t ON d."tokenId" = t.id\n    JOIN historic_market_price hmp ON d."priceId" = hmp.id\n    ORDER BY d."depositDate" desc;',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, [
      "MATERIALIZED_VIEW",
      "deposits_mv",
      "public",
    ]);
    await queryRunner.query(`DROP MATERIALIZED VIEW "deposits_mv"`);
  }
}
