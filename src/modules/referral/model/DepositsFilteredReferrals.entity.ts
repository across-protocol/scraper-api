import { ViewEntity, ViewColumn } from "typeorm";

@ViewEntity({
  expression: `
    SELECT 
      d.id,
      d."stickyReferralAddress",
      d."depositDate",
      d."priceId",
      d."tokenId",
      d.amount,
      case when d."rewardsWindowIndex" = c."windowIndex" then d."rewardsWindowIndex" else -1 end as "claimedWindowIndex"
    FROM deposit d
    left join claim c on d."rewardsWindowIndex" = c."windowIndex" and d."referralAddress" = c."account"
    WHERE "stickyReferralAddress" is not null
      AND "depositDate" is not null
      AND "tokenId" is not null
      AND "priceId" is not null
      AND status = 'filled';
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
  claimedWindowIndex?: number;

  @ViewColumn()
  usd: string;

  @ViewColumn()
  decimals: number;
}
