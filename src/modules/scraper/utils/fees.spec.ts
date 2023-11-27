import { calcPctValues, deriveRelayerFeeComponents } from "./fees";

describe("calcPctValues", () => {
  it("should calculate percentage values correctly", () => {
    const weiPct = "500000000000000000"; // 50%
    const totalAmount = "1000000000000000000"; // 1
    const usdPrice = "2000";
    const tokenDecimals = 18;

    const { pct, formattedPct, pctAmount, formattedPctAmount, pctAmountUsd } = calcPctValues(
      weiPct,
      totalAmount,
      usdPrice,
      tokenDecimals,
    );

    expect(pct).toEqual("0.5");
    expect(formattedPct).toEqual("50");
    expect(pctAmount).toEqual("500000000000000000");
    expect(formattedPctAmount).toEqual("0.5");
    expect(pctAmountUsd).toEqual("1000");
  });

  it("should handle 0 values correctly", () => {
    const weiPct = "0";
    const totalAmount = "1000000000000000000"; // 1
    const usdPrice = "2000";
    const tokenDecimals = 18;

    const { pct, formattedPct, pctAmount, formattedPctAmount, pctAmountUsd } = calcPctValues(
      weiPct,
      totalAmount,
      usdPrice,
      tokenDecimals,
    );

    expect(pct).toEqual("0");
    expect(formattedPct).toEqual("0");
    expect(pctAmount).toEqual("0");
    expect(formattedPctAmount).toEqual("0.0");
    expect(pctAmountUsd).toEqual("0");
  });
});

describe("deriveRelayerFeeComponents", () => {
  it("should derive relayer fee components correctly", () => {
    const gasFeeUsd = "1";
    const relayerFeeUsd = "2";
    const relayerFeePct = "0.5";

    const { gasFeePct, capitalFeeUsd, capitalFeePct } = deriveRelayerFeeComponents(
      gasFeeUsd,
      relayerFeeUsd,
      relayerFeePct,
    );

    expect(gasFeePct).toEqual("0.25");
    expect(capitalFeeUsd).toEqual("1");
    expect(capitalFeePct).toEqual("0.25");
  });

  it("should handle 0 values correctly", () => {
    const gasFeeUsd = "1";
    const relayerFeeUsd = "0";
    const relayerFeePct = "0";

    const { gasFeePct, capitalFeeUsd, capitalFeePct } = deriveRelayerFeeComponents(
      gasFeeUsd,
      relayerFeeUsd,
      relayerFeePct,
    );

    expect(gasFeePct).toEqual("0");
    expect(capitalFeeUsd).toEqual("0");
    expect(capitalFeePct).toEqual("0");
  });
});
