import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1659106715329 implements MigrationInterface {
  name = "Deposit1659106715329";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop materialized view if exists deposits_mv`);

    await queryRunner.query(`DROP VIEW IF EXISTS "deposit_referral_stats";`);

    await queryRunner.query(`
      CREATE VIEW "deposit_referral_stats" as
      (
        select
          d1.id,
          count(distinct d2."depositorAddr") as "referralCount",
          sum((d2.amount / power(10, t.decimals)) * hmp.usd) as "referralVolume"
        from deposit d1
        left join deposit d2 on d1."stickyReferralAddress" = d2."stickyReferralAddress"
          and d1."depositDate" >= d2."depositDate"
          and d1."stickyReferralAddress" is not null
          and d1."depositDate" is not null
          and d1."tokenId" is not null
          and d1."priceId" is not null
          and d1.status = 'filled'
        join historic_market_price hmp on d2."priceId" = hmp.id
        join token t on d2."tokenId" = t.id
        where d1."stickyReferralAddress" is not null
          and d1."depositDate" is not null
          and d1."tokenId" is not null
          and d1."priceId" is not null
          and d1.status = 'filled'
        group by d1.id
      );
    `);

    await queryRunner.query(`
      create materialized view deposits_mv as
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
      `CREATE UNIQUE INDEX "UK_deposits_mv_depositId_sourceChainId" ON deposits_mv ("depositId", "sourceChainId");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop materialized view if exists deposits_mv`);
    await queryRunner.query(`DROP VIEW IF EXISTS "deposit_referral_stats";`);
  }
}
