import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositReferralStats1667412728068 implements MigrationInterface {
  name = "DepositReferralStats1667412728068";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" DROP CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_addre"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" ADD CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_address" UNIQUE ("merkleDistributorWindowId", "address")`,
    );

    await queryRunner.query(`drop materialized view if exists deposits_mv`);
    await queryRunner.query(`DROP VIEW IF EXISTS "deposit_referral_stats";`);

    await queryRunner.query(`CREATE VIEW "deposit_referral_stats" AS 
    SELECT d1.id,
      count(distinct d2."depositorAddr") as "referralCount",
      sum((d2.amount / power(10, t.decimals)) * hmp.usd) as "referralVolume"
    FROM deposit d1
    LEFT JOIN deposit d2 on d1."stickyReferralAddress" = d2."stickyReferralAddress"
      AND d1."depositDate" >= d2."depositDate"
      AND d1."stickyReferralAddress" is not null
      AND d1."depositDate" is not null
      AND d1."tokenId" is not null
      AND d1."priceId" is not null
      AND d1.status = 'filled'
      AND d2."depositDate" >= (SELECT  coalesce(max(c."claimedAt"), '2000-01-01 00:00:00')
                               FROM    claim c
                               WHERE   c.account = d2."stickyReferralAddress"
                               AND     c."windowIndex" >= 1)
    JOIN historic_market_price hmp on d2."priceId" = hmp.id
    JOIN token t on d2."tokenId" = t.id
    WHERE d1."stickyReferralAddress" is not null
      AND d1."depositDate" is not null
      AND d1."tokenId" is not null
      AND d1."priceId" is not null
      AND d1.status = 'filled'
    GROUP BY d1.id
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        "public",
        "VIEW",
        "deposit_referral_stats",
        'SELECT d1.id,\n      count(distinct d2."depositorAddr") as "referralCount",\n      sum((d2.amount / power(10, t.decimals)) * hmp.usd) as "referralVolume"\n    FROM deposit d1\n    LEFT JOIN deposit d2 on d1."stickyReferralAddress" = d2."stickyReferralAddress"\n      AND d1."depositDate" >= d2."depositDate"\n      AND d1."stickyReferralAddress" is not null\n      AND d1."depositDate" is not null\n      AND d1."tokenId" is not null\n      AND d1."priceId" is not null\n      AND d1.status = \'filled\'\n      AND d2."depositDate" >= (SELECT  coalesce(max(c."claimedAt"), \'2000-01-01 00:00:00\')\n                               FROM    claim c\n                               WHERE   c.account = d2."stickyReferralAddress"\n                               AND     c."windowIndex" >= 1)\n    JOIN historic_market_price hmp on d2."priceId" = hmp.id\n    JOIN token t on d2."tokenId" = t.id\n    WHERE d1."stickyReferralAddress" is not null\n      AND d1."depositDate" is not null\n      AND d1."tokenId" is not null\n      AND d1."priceId" is not null\n      AND d1.status = \'filled\'\n    GROUP BY d1.id',
      ],
    );
    await queryRunner.query(`CREATE MATERIALIZED VIEW "deposits_mv" AS 
    select
      d."depositId",
      d."depositTxHash",
      d."sourceChainId",
      d."destinationChainId",
      d.amount,
      t.symbol,
      t.decimals,
      d."depositorAddr",
      d."stickyReferralAddress" as "referralAddress",
      d."depositDate",
      hmp.usd as "tokenUsdPrice",
      (d."realizedLpFeePctCapped" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd as "realizedLpFeeUsd",
      (d."bridgeFeePct" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd as "bridgeFeeUsd",
    case
      when d1."referralCount" >= 20 or d1."referralVolume" >= 500000 then 0.8
      when d1."referralCount" >= 10 or d1."referralVolume" >= 250000 then 0.7
      when d1."referralCount" >= 5 or d1."referralVolume" >= 100000 then 0.6
      when d1."referralCount" >= 3 or d1."referralVolume" >= 50000 then 0.5
      else 0.4
    end as "referralRate",
    case
        when d."depositDate" < '2022-07-22 17:00:00' then 3
        else 2
    end as multiplier
    from deposit d
    join "deposit_referral_stats" d1 on d.id = d1.id
    join token t on d."tokenId" = t.id
    join historic_market_price hmp on d."priceId" = hmp.id
    order by d."depositDate" desc;
  `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`,
      [
        "public",
        "MATERIALIZED_VIEW",
        "deposits_mv",
        'select\n      d."depositId",\n      d."depositTxHash",\n      d."sourceChainId",\n      d."destinationChainId",\n      d.amount,\n      t.symbol,\n      t.decimals,\n      d."depositorAddr",\n      d."stickyReferralAddress" as "referralAddress",\n      d."depositDate",\n      hmp.usd as "tokenUsdPrice",\n      (d."realizedLpFeePctCapped" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd as "realizedLpFeeUsd",\n      (d."bridgeFeePct" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd as "bridgeFeeUsd",\n    case\n      when d1."referralCount" >= 20 or d1."referralVolume" >= 500000 then 0.8\n      when d1."referralCount" >= 10 or d1."referralVolume" >= 250000 then 0.7\n      when d1."referralCount" >= 5 or d1."referralVolume" >= 100000 then 0.6\n      when d1."referralCount" >= 3 or d1."referralVolume" >= 50000 then 0.5\n      else 0.4\n    end as "referralRate",\n    case\n        when d."depositDate" < \'2022-07-22 17:00:00\' then 3\n        else 2\n    end as multiplier\n    from deposit d\n    join "deposit_referral_stats" d1 on d.id = d1.id\n    join token t on d."tokenId" = t.id\n    join historic_market_price hmp on d."priceId" = hmp.id\n    order by d."depositDate" desc;',
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
    await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, [
      "VIEW",
      "deposit_referral_stats",
      "public",
    ]);
    await queryRunner.query(`DROP VIEW "deposit_referral_stats"`);
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" DROP CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merkle_distributor_recipient" ADD CONSTRAINT "UK_merkle_distributor_recipient_merkleDistributorWindowId_addre" UNIQUE ("merkleDistributorWindowId", "address")`,
    );
  }
}
