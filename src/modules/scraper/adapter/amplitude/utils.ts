import BigNumber from "bignumber.js";

export const fixedPointAdjustment = new BigNumber(10).pow(18);

export function formatWeiPct(weiPct: string, decimals?: number) {
  return new BigNumber(weiPct).dividedBy(fixedPointAdjustment).multipliedBy(100).toFixed(decimals);
}

export function formatWeiPctOfTotal(weiPct: string, total: string, decimals?: number) {
  return new BigNumber(total).multipliedBy(weiPct).dividedBy(fixedPointAdjustment).toFixed(decimals);
}

export function getFormattedWeiPctValues(weiPct: string, totalAmount: string, usdPrice: string) {
  const weiPctTotal = formatWeiPctOfTotal(weiPct, totalAmount);
  return {
    pct: formatWeiPct(weiPct, 3),
    total: weiPctTotal,
    totalUsd: new BigNumber(weiPctTotal).multipliedBy(usdPrice).toFixed(),
  };
}

export function makeWeiPctValuesFormatter(totalAmount: string, usdPrice: string) {
  return (weiPct: string) => getFormattedWeiPctValues(weiPct, totalAmount, usdPrice);
}
