import { MigrationInterface, QueryRunner } from "typeorm";

export class MaterializedView1659106715326 implements MigrationInterface {
  name = "MaterializedView1659106715326";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`drop materialized view if exists deposits_mv`);
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
          d."referralAddress",
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
  }
}
