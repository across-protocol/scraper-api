import { AcrossContractsVersion } from "../../web3/model/across-version";
import { splitBlockRanges } from "./blocks";

describe("blocks", () => {
  it("[10, 20, 30] 2 10", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      2,
      10,
    );
    expect(interval).toEqual(undefined);
  });
  it("[10] 10 12", () => {
    const interval = splitBlockRanges([{ startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 }], 10, 12);
    expect(interval).toEqual([{ from: 10, to: 12, address: "0x1", acrossVersion: AcrossContractsVersion.V3 }]);
  });
  it("[10, 20, 30] 10 12", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      10,
      12,
    );
    expect(interval).toEqual([{ from: 10, to: 12, address: "0x1", acrossVersion: AcrossContractsVersion.V3 }]);
  });
  it("[10, 20, 30] 20 21", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      20,
      21,
    );
    expect(interval).toEqual([{ from: 20, to: 21, address: "0x2", acrossVersion: AcrossContractsVersion.V3 }]);
  });
  it("[10, 20, 30] 10 20", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      10,
      20,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
      { from: 20, to: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
    ]);
  });
  it("[10, 20, 30] 10 21", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      10,
      21,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
      { from: 20, to: 21, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
    ]);
  });
  it("[10, 20, 30] 10 35", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      10,
      35,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
      { from: 20, to: 29, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
      { from: 30, to: 35, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
    ]);
  });
  it("[10, 20, 30] 10 30", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      10,
      30,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
      { from: 20, to: 29, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
      { from: 30, to: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
    ]);
  });
  it("[5, 10, 20, 30] 10 30", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 5, address: "0x05", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      10,
      30,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
      { from: 20, to: 29, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
      { from: 30, to: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
    ]);
  });
  it("[5, 10, 20, 30] 11 30", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 5, address: "0x05", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 10, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 20, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      ],
      11,
      30,
    );
    expect(interval).toEqual([
      { from: 11, to: 19, address: "0x1", acrossVersion: AcrossContractsVersion.V3 },
      { from: 20, to: 29, address: "0x2", acrossVersion: AcrossContractsVersion.V3 },
      { from: 30, to: 30, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
    ]);
  });
  it("[0, 3, 7, 9] 2 8", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 0, address: "0x0", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 3, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 7, address: "0x7", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3 },
      ],
      2,
      8,
    );
    expect(interval).toEqual([
      { from: 2, to: 2, address: "0x0", acrossVersion: AcrossContractsVersion.V3 },
      { from: 3, to: 6, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
      { from: 7, to: 8, address: "0x7", acrossVersion: AcrossContractsVersion.V3 },
    ]);
  });
  it("[0, 3, 7, 9] 10 12", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 0, address: "0x0", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 3, address: "0x3", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 7, address: "0x7", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3 },
      ],
      10,
      12,
    );
    expect(interval).toEqual([{ from: 10, to: 12, address: "0x9", acrossVersion: AcrossContractsVersion.V3 }]);
  });
  it("[0, 9, 9] 10 12 multiple versions overlapping start block", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 0, address: "0x0", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3_5 },
      ],
      10,
      12,
    );
    expect(interval).toEqual([
      {
        from: 10,
        to: 12,
        address: "0x9",
        acrossVersion: AcrossContractsVersion.V3,
      },
      {
        from: 10,
        to: 12,
        address: "0x9",
        acrossVersion: AcrossContractsVersion.V3_5,
      },
    ]);
  });
  it("[0, 9, 9, 9] 10 12 multiple versions overlapping start block", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 0, address: "0x0", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3_5 },
        { startBlockNumber: 9, address: "0x10", acrossVersion: AcrossContractsVersion.V3_5 },
      ],
      10,
      12,
    );
    expect(interval).toEqual([
      {
        from: 10,
        to: 12,
        address: "0x9",
        acrossVersion: AcrossContractsVersion.V3,
      },
      {
        from: 10,
        to: 12,
        address: "0x9",
        acrossVersion: AcrossContractsVersion.V3_5,
      },
      {
        from: 10,
        to: 12,
        address: "0x10",
        acrossVersion: AcrossContractsVersion.V3_5,
      },
    ]);
  });
  it("[0, 9, 9, 9] 3 12 multiple versions overlapping start block", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 0, address: "0x0", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3 },
        { startBlockNumber: 9, address: "0x9", acrossVersion: AcrossContractsVersion.V3_5 },
        { startBlockNumber: 9, address: "0x10", acrossVersion: AcrossContractsVersion.V3_5 },
      ],
      3,
      12,
    );
    expect(interval).toEqual([
      {
        from: 3,
        to: 8,
        address: "0x0",
        acrossVersion: AcrossContractsVersion.V3,
      },
      {
        from: 9,
        to: 12,
        address: "0x9",
        acrossVersion: AcrossContractsVersion.V3,
      },
      {
        from: 9,
        to: 12,
        address: "0x9",
        acrossVersion: AcrossContractsVersion.V3_5,
      },
      {
        from: 9,
        to: 12,
        address: "0x10",
        acrossVersion: AcrossContractsVersion.V3_5,
      },
    ]);
  });
});

