export const getReferralsQuery = () => {
  return `
    select
      *,
      case
        when d."depositorAddr" = $1 and d."referralAddress" = $1
          then trunc(cast(d."realizedLpFeeUsd" * d."referralRate" / $2 * power(10, 18) * d.multiplier as decimal))
        when d."depositorAddr" = $1
        then trunc(cast(d."realizedLpFeeUsd" * d."referralRate" / $2 * 0.25 * power(10, 18) * d.multiplier as decimal))
        else trunc(cast(d."realizedLpFeeUsd" * d."referralRate" / $2 * 0.75 * power(10, 18) * d.multiplier as decimal))
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
        (d."realizedLpFeePctCapped" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd as "realizedLpFeeUsd",
      case
        when d1."referralCount" >= 20 or d1."referralVolume" >= 500000 then 0.8
        when d1."referralCount" >= 10 or d1."referralVolume" >= 250000 then 0.7
        when d1."referralCount" >= 5 or d1."referralVolume" >= 100000 then 0.6
        when d1."referralCount" >= 3 or d1."referralVolume" >= 50000 then 0.5
        else 0.4
      end as "referralRate",
      case
          when d."depositDate"::date <= '2022-08-01' then 3
          else 1
      end as multiplier
      from deposit d
      join "deposit_referral_stats" d1 on d.id = d1.id
      join token t on d."tokenId" = t.id
      join historic_market_price hmp on d."priceId" = hmp.id
      order by d."depositDate" desc
    ) as d
    where d."referralAddress" = $1 or
    (d."depositorAddr" = $1 and d."referralAddress" is not null)
    limit $3
    offset $4;
  `;
};

export const getTotalReferralRewardsQuery = () => {
  return `
    select
      sum(
        case
          when d."depositorAddr" = $1 and d."referralAddress" = $1
            then trunc(cast(d."realizedLpFeeUsd" * d."referralRate" / $2 * power(10, 18) * d.multiplier as decimal))
          when d."depositorAddr" = $1
          then trunc(cast(d."realizedLpFeeUsd" * d."referralRate" / $2 * 0.25 * power(10, 18) * d.multiplier as decimal))
          else trunc(cast(d."realizedLpFeeUsd" * d."referralRate" / $2 * 0.75 * power(10, 18) * d.multiplier as decimal))
        end
      ) as "acxRewards"
    from (
      select
        d.amount,
        t.decimals,
        d."depositorAddr",
        d."referralAddress",
        (d."realizedLpFeePctCapped" / power(10, 18)) * (d.amount / power(10, t.decimals)) * hmp.usd as "realizedLpFeeUsd",
      case
        when d1."referralCount" >= 20 or d1."referralVolume" >= 500000 then 0.8
        when d1."referralCount" >= 10 or d1."referralVolume" >= 250000 then 0.7
        when d1."referralCount" >= 5 or d1."referralVolume" >= 100000 then 0.6
        when d1."referralCount" >= 3 or d1."referralVolume" >= 50000 then 0.5
        else 0.4
      end as "referralRate",
      case
          when d."depositDate"::date <= '2022-08-01' then 3
          else 1
      end as multiplier
      from deposit d
      join "deposit_referral_stats" d1 on d.id = d1.id
      join token t on d."tokenId" = t.id
      join historic_market_price hmp on d."priceId" = hmp.id
    ) as d
    where d."referralAddress" = $1 or
    (d."depositorAddr" = $1 and d."referralAddress" is not null);  
  `;
};

export const getReferreeWalletsQuery = () => {
  return `select count(*) from (
    select distinct on (d."depositorAddr") d."depositorAddr"
    from deposit d
    where d."referralAddress" = $1 and
          d."depositDate" is not null and
          d."tokenId" is not null and
          d."priceId" is not null and
          d.status = 'filled'
  ) t`;
};

export const getReferralTransfersQuery = () => {
  return `select count(*)
    from deposit d
    where d."referralAddress" = $1 and
          d."depositDate" is not null and
          d."tokenId" is not null and
          d."priceId" is not null and
          d.status = 'filled'`;
};

export const getReferralVolumeQuery = () => {
  return `
    select sum(d.amount / power(10, t.decimals) * hmp.usd) as volume
    from deposit d
    join token t on d."tokenId" = t.id
    join historic_market_price hmp on d."priceId" = hmp.id
    where d."referralAddress" = $1
      and d."depositDate" is not null
      and d."tokenId" is not null
      and d."priceId" is not null
      and d.status = 'filled'`;
};

export const getActiveRefereesCountQuery = () => {
  return `
    select count(*)
    from (
        select d.id, d."depositorAddr", d."depositDate", d."referralAddress", row_number() over (partition by d."depositorAddr" order by d."depositDate" desc) r
        from deposit d
        where d."referralAddress" is not null and
          d."depositDate" is not null and
          d."tokenId" is not null and
          d."priceId" is not null and
          d.status = 'filled'
    ) temp
    where temp.r = 1 and temp."referralAddress" = $1;
  `;
};
