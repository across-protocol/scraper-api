import { AcrossContractsVersion } from "../../web3/model/across-version";

/**
 * Given a (from, to) block range and a list of contracts along with the deployment date,
 * determine which contracts need to be queried
 */
export function splitBlockRanges(
  contracts: { address: string; startBlockNumber: number; acrossVersion: AcrossContractsVersion }[] = [],
  from: number,
  to: number,
) {
  if (contracts.length === 0 || contracts[0].startBlockNumber > from) return undefined;

  const intervals: { from: number; to: number; address: string; acrossVersion: AcrossContractsVersion }[] = [];

  for (let i = 0; i < contracts.length; i++) {
    const currentContract = contracts[i];

    if (currentContract.startBlockNumber > to) break;

    const intervalFrom = Math.max(from, currentContract.startBlockNumber);
    let intervalTo = to;

    // Determine the end of the current contract's interval
    for (let j = i + 1; j < contracts.length; j++) {
      if (contracts[j].startBlockNumber > currentContract.startBlockNumber) {
        intervalTo = Math.min(to, contracts[j].startBlockNumber - 1);
        break;
      }
    }

    if (intervalFrom <= intervalTo) {
      intervals.push({
        from: intervalFrom,
        to: intervalTo,
        address: currentContract.address,
        acrossVersion: currentContract.acrossVersion,
      });
    }
  }

  return intervals;
}
