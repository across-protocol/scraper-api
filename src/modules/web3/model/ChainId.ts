export type ChainId = number;

export const ChainIds = {
  mainnet: 1,
  optimism: 10,
  boba: 288,
  polygon: 137,
  arbitrum: 42161,
  goerli: 5,
  kovan: 42,
  rinkeby: 4,
  arbitrumGoerli: 421613,
  arbitrumRinkeby: 421611,
  optimismKovan: 69,
  polygonMumbai: 80001,
  zkSyncMainnet: 324,
  zkSyncTestnet: 280,
  base: 8453,
  baseGoerli: 84531,
};

export const ChainIdToName = Object.entries(ChainIds).reduce((idToName, entry) => {
  const [name, id] = entry;
  return {
    ...idToName,
    [id]: name,
  };
}, {} as Record<string, keyof typeof ChainIds>);

export type Web3Error = {
  error: {
    code: Web3ErrorCode;
  };
};

export enum Web3ErrorCode {
  BLOCK_RANGE_TOO_LARGE = -32005,
  EXCEEDED_MAXIMUM_BLOCK_RANGE = -32000,
  LOG_RESPONSE_SIZE_EXCEEDED = -32602,
  LOG_RESPONSE_SIZE_EXCEEDED_2 = -32605,
  ZKSYNC_BLOCK_RANGE_TOO_LARGE = -32614,
}
