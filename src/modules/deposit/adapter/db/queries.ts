const wei = 1_000_000_000_000_000_000;

export const getTotalVolumeQuery = () => {
  return `
    select trunc(sum(d.amount / power(10, t.decimals) * hmp.usd)) as "totalVolumeUsd"
    from deposit as d
    inner join token t on t.id = d."tokenId"
    inner join historic_market_price hmp on d."priceId" = hmp.id
    where "tokenId" is not null and "priceId" is not null and status = 'filled';
  `;
};

export const getTotalDepositsQuery = () => {
  return `
    select count(*) as "totalDeposits" from deposit;
  `;
};

export const getAvgFillTimeQuery = () => {
  return `
    select trunc(avg(extract(epoch from "filledDate" - "depositDate"))) as "avgFillTime"
    from deposit
    where status = 'filled' and
      "filledDate" is not null and
      "depositDate" > NOW() - INTERVAL '1 days' and
      "depositRelayerFeePct" / power(10, 18) >= 0.0001;
  `;
};

export const getReferralsForEtl = () => {
  return `
    select
      d."depositId",
      d."sourceChainId",
      d."referralAddress",
      d."multiplier",
      d."referralRate",
      d."bridgeFeeUsd",
      d."acxUsdPrice",
      trunc(cast(d."bridgeFeeUsd" * d."referralRate" / d."acxUsdPrice" * ${wei} * d.multiplier as decimal))as "acxRewards",
      trunc(cast(d."bridgeFeeUsd" * d."referralRate" / d."acxUsdPrice" * 0.75 * ${wei} * d.multiplier as decimal)) as "acxRewardsAmountReferrer",
      trunc(cast(d."bridgeFeeUsd" * d."referralRate" / d."acxUsdPrice" * 0.25 * ${wei} * d.multiplier as decimal)) as "acxRewardsAmountReferee"
    from deposits_mv as d
    where d."depositDate"::date = $1
    order by d."depositDate" DESC;
  `;
};
