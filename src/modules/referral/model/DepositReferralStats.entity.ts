import { ViewEntity, ViewColumn } from "typeorm";

import { configValues } from "../../configuration";

@ViewEntity({
  expression: `
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
                               AND     c."windowIndex" >= ${
                                 configValues().web3.merkleDistributor.referralsStartWindowIndex
                               })
    JOIN historic_market_price hmp on d2."priceId" = hmp.id
    JOIN token t on d2."tokenId" = t.id
    WHERE d1."stickyReferralAddress" is not null
      AND d1."depositDate" is not null
      AND d1."tokenId" is not null
      AND d1."priceId" is not null
      AND d1.status = 'filled'
    GROUP BY d1.id
  `,
})
export class DepositReferralStats {
  @ViewColumn()
  id: number;

  @ViewColumn()
  referralCount: number;

  @ViewColumn()
  referralVolume: number;
}
