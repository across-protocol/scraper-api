import { MigrationInterface, QueryRunner } from "typeorm";

export class DepositReferralStats1667823088146 implements MigrationInterface {
  name = "DepositReferralStats1667823088146";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS deposits_mv`);
    await queryRunner.query(`DROP VIEW IF EXISTS "deposit_referral_stats";`);

    await queryRunner.query(`
    CREATE VIEW "deposit_referral_stats" AS 
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
      `
      INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value")
        VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)
      `,
      [
        "public",
        "VIEW",
        "deposit_referral_stats",
        'SELECT d1.id,\n      count(distinct d2."depositorAddr") as "referralCount",\n      sum((d2.amount / power(10, t.decimals)) * hmp.usd) as "referralVolume"\n    FROM deposit d1\n    LEFT JOIN deposit d2 on d1."stickyReferralAddress" = d2."stickyReferralAddress"\n      AND d1."depositDate" >= d2."depositDate"\n      AND d1."stickyReferralAddress" is not null\n      AND d1."depositDate" is not null\n      AND d1."tokenId" is not null\n      AND d1."priceId" is not null\n      AND d1.status = \'filled\'\n      AND d2."depositDate" >= (SELECT  coalesce(max(c."claimedAt"), \'2000-01-01 00:00:00\')\n                               FROM    claim c\n                               WHERE   c.account = d2."stickyReferralAddress"\n                               AND     c."windowIndex" >= 1)\n    JOIN historic_market_price hmp on d2."priceId" = hmp.id\n    JOIN token t on d2."tokenId" = t.id\n    WHERE d1."stickyReferralAddress" is not null\n      AND d1."depositDate" is not null\n      AND d1."tokenId" is not null\n      AND d1."priceId" is not null\n      AND d1.status = \'filled\'\n    GROUP BY d1.id',
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, [
      "VIEW",
      "deposit_referral_stats",
      "public",
    ]);
    await queryRunner.query(`DROP VIEW "deposit_referral_stats"`);
  }
}
