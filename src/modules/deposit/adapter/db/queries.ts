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
          "depositDate" > NOW() - INTERVAL '30 days' and
          "depositRelayerFeePct" / power(10, 18) >= 0.0001;
  `;
};
