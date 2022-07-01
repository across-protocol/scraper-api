export const getReferralsQuery = () => {
  return `
    select
      *,
      case
        when d."depositorAddr" = $1 and d."referralAddress" = $1
          then cast(d."realizedLpFeeUsd" * (1 + d."referralRate") / 0.025 * power(10, 18) as varchar)
        when d."depositorAddr" = $1
        then cast(d."realizedLpFeeUsd" * (1 + d."referralRate") / 0.025 * 0.25 * power(10, 18) as varchar)
        else cast(d."realizedLpFeeUsd" * (1 + d."referralRate") / 0.025 * 0.75 * power(10, 18) as varchar)
      end as "acxRewards"
    from (
      select d."depositTxHash",
        d."sourceChainId",
        d."destinationChainId",
        d.amount,
        t.symbol,
        t.decimals,
        d."depositorAddr",
        d."referralAddress",
        d."depositDate",
        (d."realizedLpFeePct" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd as "realizedLpFeeUsd",
      case
        when d1."referralCount" >= 20 or d1."referralVolume" >= 500000 then 0.8
        when d1."referralCount" >= 10 or d1."referralVolume" >= 250000 then 0.7
        when d1."referralCount" >= 5 or d1."referralVolume" >= 100000 then 0.6
        when d1."referralCount" >= 3 or d1."referralVolume" >= 50000 then 0.5
        else 0.4
      end as "referralRate"
      from deposit d
      join "deposit_referral_stats" d1 on d.id = d1.id
      join token t on d."tokenId" = t.id
      join historic_market_price hmp on d."priceId" = hmp.id
      order by d."depositDate" desc
    ) as d
    where d."referralAddress" = $1 or
    (d."depositorAddr" = $1 and d."referralAddress" is not null)
    limit $2
    offset $3;
  `;
};
