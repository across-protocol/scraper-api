import { splitBlockRanges } from "./blocks";

describe("blocks", () => {
  it("[10, 20, 30] 2 10", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      2,
      10,
    );
    expect(interval).toEqual(undefined);
  });
  it("[10] 10 12", () => {
    const interval = splitBlockRanges([{ startBlockNumber: 10, address: "0x1", acrossVersion: "v" }], 10, 12);
    expect(interval).toEqual([{ from: 10, to: 12, address: "0x1" }]);
  });
  it("[10, 20, 30] 10 12", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      10,
      12,
    );
    expect(interval).toEqual([{ from: 10, to: 12, address: "0x1" }]);
  });
  it("[10, 20, 30] 20 21", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      20,
      21,
    );
    expect(interval).toEqual([{ from: 20, to: 21, address: "0x2" }]);
  });
  it("[10, 20, 30] 10 20", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      10,
      20,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1" },
      { from: 20, to: 20, address: "0x2" },
    ]);
  });
  it("[10, 20, 30] 10 21", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      10,
      21,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1" },
      { from: 20, to: 21, address: "0x2" },
    ]);
  });
  it("[10, 20, 30] 10 35", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      10,
      35,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1" },
      { from: 20, to: 29, address: "0x2" },
      { from: 30, to: 35, address: "0x3" },
    ]);
  });
  it("[10, 20, 30] 10 30", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      10,
      30,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1" },
      { from: 20, to: 29, address: "0x2" },
      { from: 30, to: 30, address: "0x3" },
    ]);
  });
  it("[5, 10, 20, 30] 10 30", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 5, address: "0x05", acrossVersion: "v" },
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      10,
      30,
    );
    expect(interval).toEqual([
      { from: 10, to: 19, address: "0x1" },
      { from: 20, to: 29, address: "0x2" },
      { from: 30, to: 30, address: "0x3" },
    ]);
  });
  it("[5, 10, 20, 30] 11 30", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 5, address: "0x05", acrossVersion: "v" },
        { startBlockNumber: 10, address: "0x1", acrossVersion: "v" },
        { startBlockNumber: 20, address: "0x2", acrossVersion: "v" },
        { startBlockNumber: 30, address: "0x3", acrossVersion: "v" },
      ],
      11,
      30,
    );
    expect(interval).toEqual([
      { from: 11, to: 19, address: "0x1" },
      { from: 20, to: 29, address: "0x2" },
      { from: 30, to: 30, address: "0x3" },
    ]);
  });
  it("[0, 3, 7, 9] 2 8", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 0, address: "0x0", acrossVersion: "v" },
        { startBlockNumber: 3, address: "0x3", acrossVersion: "v" },
        { startBlockNumber: 7, address: "0x7", acrossVersion: "v" },
        { startBlockNumber: 9, address: "0x9", acrossVersion: "v" },
      ],
      2,
      8,
    );
    expect(interval).toEqual([
      { from: 2, to: 2, address: "0x0" },
      { from: 3, to: 6, address: "0x3" },
      { from: 7, to: 8, address: "0x7" },
    ]);
  });
  it("[0, 3, 7, 9] 10 12", () => {
    const interval = splitBlockRanges(
      [
        { startBlockNumber: 0, address: "0x0", acrossVersion: "v" },
        { startBlockNumber: 3, address: "0x3", acrossVersion: "v" },
        { startBlockNumber: 7, address: "0x7", acrossVersion: "v" },
        { startBlockNumber: 9, address: "0x9", acrossVersion: "v" },
      ],
      10,
      12,
    );
    expect(interval).toEqual([{ from: 10, to: 12, address: "0x9", acrossVersion: "v" }]);
  });
});
