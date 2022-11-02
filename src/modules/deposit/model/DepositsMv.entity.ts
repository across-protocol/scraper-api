import { ViewEntity, ViewColumn, Unique } from "typeorm";

import { DepositReferralStats } from "../../referral/model/DepositReferralStats.entity";

@ViewEntity({
  dependsOn: [DepositReferralStats],
  materialized: true,
  expression: `
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
  `,
})
@Unique("UK_deposits_mv_depositId_sourceChainId", ["depositId", "sourceChainId"])
export class DepositsMv {
  @ViewColumn()
  depositId: number;

  @ViewColumn()
  depositTxHash: string;

  @ViewColumn()
  sourceChainId: number;

  @ViewColumn()
  destinationChainId: number;

  @ViewColumn()
  amount: string;

  @ViewColumn()
  symbol: string;

  @ViewColumn()
  decimals: number;

  @ViewColumn()
  depositorAddr: string;

  @ViewColumn()
  stickyReferralAddress: string;

  @ViewColumn()
  depositDate: Date;

  @ViewColumn()
  tokenUsdPrice: string;

  @ViewColumn()
  realizedLpFeeUsd: string;

  @ViewColumn()
  bridgeFeeUsd: string;
}
