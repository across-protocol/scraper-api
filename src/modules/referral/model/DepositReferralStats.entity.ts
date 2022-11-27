import { ViewEntity, ViewColumn } from "typeorm";
import { DepositsFilteredReferrals } from "./DepositsFilteredReferrals.entity";

@ViewEntity({
  expression: `
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
  `,
  dependsOn: [DepositsFilteredReferrals],
})
export class DepositReferralStats {
  @ViewColumn()
  id: number;

  @ViewColumn()
  referralCount: number;

  @ViewColumn()
  referralVolume: number;
}
