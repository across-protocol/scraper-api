/**
 * Given a (from, to) block range and a list of contracts along with the deployment date,
 * determine which contracts need to be queried
 */
export function splitBlockRanges(
  contracts: { address: string; startBlockNumber: number; acrossVersion: string }[] = [],
  from: number,
  to: number,
) {
  if (contracts[0].startBlockNumber > from) return undefined;

  const intervals: { from: number; to: number; address: string; acrossVersion: string }[] = [];

  if (contracts.length === 1) {
    return [{ from, to, address: contracts[0].address, acrossVersion: contracts[0].acrossVersion }];
  }

  for (let i = 0; i < contracts.length - 1; i++) {
    if (intervals.length === 0) {
      if (contracts[i].startBlockNumber <= from && contracts[i + 1].startBlockNumber > from) {
        intervals.push({
          from,
          to: Math.min(to, contracts[i + 1].startBlockNumber - 1),
          address: contracts[i].address,
          acrossVersion: contracts[i].acrossVersion,
        });
      } else {
        continue;
      }
    } else {
      if (contracts[i].startBlockNumber > to) break;
      intervals.push({
        from: contracts[i].startBlockNumber,
        to: Math.min(to, contracts[i + 1].startBlockNumber - 1),
        address: contracts[i].address,
        acrossVersion: contracts[i].acrossVersion,
      });

      if (i === contracts.length - 2 && contracts[i + 1].startBlockNumber <= to) {
        intervals.push({
          from: contracts[i + 1].startBlockNumber,
          to,
          address: contracts[i + 1].address,
          acrossVersion: contracts[i + 1].acrossVersion,
        });
      }
    }
  }

  return intervals;
}
