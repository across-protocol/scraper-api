import BigNumber from "bignumber.js";
import { utils } from "ethers";

export const fixedPointAdjustment = new BigNumber(10).pow(18);

export function toWeiPct(pct: string) {
  return new BigNumber(pct).multipliedBy(fixedPointAdjustment).toFixed(0);
}

export function calcPctValues(weiPct: string, totalAmount: string, usdPrice: string, tokenDecimals: number) {
  const pctAmount = new BigNumber(totalAmount).multipliedBy(weiPct).dividedBy(fixedPointAdjustment).toFixed(0);
  const formattedPctAmount = utils.formatUnits(pctAmount, tokenDecimals);
  const pctAmountUsd = new BigNumber(utils.formatUnits(pctAmount.toString(), tokenDecimals))
    .multipliedBy(usdPrice)
    .toFixed();

  const pct = new BigNumber(weiPct).dividedBy(fixedPointAdjustment);
  const formattedPct = pct.multipliedBy(100).toFixed();

  return {
    pct: pct.toString(),
    formattedPct,
    pctAmount,
    formattedPctAmount,
    pctAmountUsd,
  };
}

export function makePctValuesCalculator(totalAmount: string, usdPrice: string, tokenDecimals: number) {
  return (weiPct: string) => calcPctValues(weiPct, totalAmount, usdPrice, tokenDecimals);
}

export function getFormattedAmountValues(amount: string, decimals: number, usdPrice: string) {
  const formattedAmount = utils.formatUnits(amount, decimals);
  return {
    formattedAmount,
    formattedAmountUsd: new BigNumber(formattedAmount).multipliedBy(usdPrice).toFixed(),
  };
}

export function makeAmountValuesFormatter(decimals: number, usdPrice: string) {
  return (amount: string) => getFormattedAmountValues(amount, decimals, usdPrice);
}

export function deriveRelayerFeeComponents(
  gasFeeUsd: string,
  relayerFeeUsd: string,
  relayerFeePct: BigNumber | number | string,
) {
  const isRelayerFeeZero = new BigNumber(relayerFeeUsd).isZero();
  const gasFeePct = isRelayerFeeZero
    ? 0
    : new BigNumber(gasFeeUsd).dividedBy(relayerFeeUsd).multipliedBy(relayerFeePct);
  const capitalFeeUsd = isRelayerFeeZero ? 0 : new BigNumber(relayerFeeUsd).minus(gasFeeUsd);
  const capitalFeePct = isRelayerFeeZero ? 0 : new BigNumber(relayerFeePct).minus(gasFeePct);
  return {
    gasFeeUsd,
    gasFeePct: gasFeePct.toFixed(),
    capitalFeeUsd: capitalFeeUsd.toFixed(),
    capitalFeePct: capitalFeePct.toFixed(),
  };
}
