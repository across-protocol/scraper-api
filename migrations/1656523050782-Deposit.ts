import { MigrationInterface, QueryRunner } from "typeorm";

export class Deposit1656523050782 implements MigrationInterface {
  name = "Deposit1656523050782";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW "deposit_referral_stats" as
      (
        select
          d1.id,
          count(*) as "referralCount",
          sum((d2.amount / power(10, t.decimals)) * hmp.usd) as "referralVolume"
        from deposit d1
        left join deposit d2 on d1."referralAddress" = d2."referralAddress"
          and d1."depositDate" >= d2."depositDate"
          and d1."referralAddress" is not null
          and d1."depositDate" is not null
          and d1."tokenId" is not null
          and d1."priceId" is not null
          and d1.status = 'filled'
        join historic_market_price hmp on d2."priceId" = hmp.id
        join token t on d2."tokenId" = t.id
        where d1."referralAddress" is not null
          and d1."depositDate" is not null
          and d1."tokenId" is not null
          and d1."priceId" is not null
          and d1.status = 'filled'
        group by d1.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS "deposit_referral_stats";`);
  }
}
