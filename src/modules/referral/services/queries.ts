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
    from deposits_mv as d
    where d."referralAddress" = $1 or
    (d."depositorAddr" = $1 and d."referralAddress" is not null)
    order by d."depositDate" DESC
    limit $3
    offset $4;
  `;
};

export const getReferralsTotalQuery = () => {
  return `
    select count(*)
    from deposits_mv as d
    where d."referralAddress" = $1 or
    (d."depositorAddr" = $1 and d."referralAddress" is not null)
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
    from deposits_mv as d
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
