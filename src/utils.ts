import { applyDecorators } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ChainIds } from "./modules/web3/model/ChainId";

export const chainIdToInfo = {
  [ChainIds.mainnet]: {
    name: "Ethereum",
    chainId: ChainIds.mainnet,
    nativeSymbol: "eth",
  },
  [ChainIds.arbitrum]: {
    name: "Arbitrum",
    chainId: ChainIds.arbitrum,
    nativeSymbol: "eth",
  },
  [ChainIds.boba]: {
    name: "Boba",
    chainId: ChainIds.boba,
    nativeSymbol: "eth",
  },
  [ChainIds.optimism]: {
    name: "Optimism",
    chainId: ChainIds.optimism,
    nativeSymbol: "eth",
  },
  [ChainIds.polygon]: {
    name: "Polygon",
    chainId: ChainIds.polygon,
    nativeSymbol: "matic",
  },
};

export const wait = (seconds = 1) =>
  new Promise((res) => {
    setTimeout(res, 1000 * seconds);
  });

export const EnhancedCron = (cronExpression: string) => {
  if (process.env.DISABLE_CRONS != "true") return applyDecorators(Cron(cronExpression));
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  else return () => {};
};

export const getRandomInt = (min = 0, max = 1000000) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const splitArrayInChunks = <T>(array: T[], chunk_size: number) =>
  Array(Math.ceil(array.length / chunk_size))
    .fill(0)
    .map((_, index) => index * chunk_size)
    .map((begin) => array.slice(begin, begin + chunk_size));
