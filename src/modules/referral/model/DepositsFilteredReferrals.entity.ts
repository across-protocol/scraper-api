import { ViewEntity, ViewColumn } from "typeorm";

@ViewEntity({
  expression: `
    SELECT 
      d.id,
      d."depositorAddr",
      d."stickyReferralAddress",
      d."depositDate",
      d."priceId",
      d."tokenId",
      d.amount,
      d."rewardsWindowIndex",
      case when d."rewardsWindowIndex" = c."windowIndex" then d."rewardsWindowIndex" else -1 end as "referralClaimedWindowIndex",
      hmp."usd",
      t.decimals
    FROM deposit d
    JOIN historic_market_price hmp on d."priceId" = hmp.id
    JOIN token t on d."tokenId" = t.id
    LEFT JOIN claim c on d."rewardsWindowIndex" = c."windowIndex" and d."stickyReferralAddress" = c."account"
    WHERE "stickyReferralAddress" is not null
      AND "depositDate" is not null
      AND "tokenId" is not null
      AND "priceId" is not null
      AND status = 'filled'
      AND d."acxUsdPrice" is not null
      AND (
        d."depositDate" < '2023-11-30 20:00:00' 
        OR (d."depositDate" >= '2023-11-30 20:00:00' AND d."destinationChainId" != 10)
      );
  `,
})
export class DepositsFilteredReferrals {
  @ViewColumn()
  id: number;

  @ViewColumn()
  stickyReferralAddress?: string;

  @ViewColumn()
  tokenId?: number;

  @ViewColumn()
  priceId?: number;

  @ViewColumn()
  depositDate?: Date;

  @ViewColumn()
  amount: string;

  @ViewColumn()
  depositorAddr: string;

  @ViewColumn()
  referralClaimedWindowIndex?: number;

  @ViewColumn()
  rewardsWindowIndex?: number;

  @ViewColumn()
  usd: string;

  @ViewColumn()
  decimals: number;
}
