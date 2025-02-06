import { HttpException, HttpStatus, applyDecorators } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ethers } from "ethers";
import { ChainIds } from "./modules/web3/model/ChainId";

export class InvalidAddressException extends HttpException {
  constructor() {
    super(
      {
        error: InvalidAddressException.name,
        message: "Invalid address",
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

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
  [ChainIds.optimismSepolia]: {
    name: "Optimism Sepolia",
    chainId: ChainIds.optimismSepolia,
    nativeSymbol: "eth",
  },
  [ChainIds.polygon]: {
    name: "Polygon",
    chainId: ChainIds.polygon,
    nativeSymbol: "matic",
  },
  [ChainIds.base]: {
    name: "Base",
    chainId: ChainIds.base,
    nativeSymbol: "eth",
  },
  [ChainIds.baseSepolia]: {
    name: "Base Sepolia",
    chainId: ChainIds.baseSepolia,
    nativeSymbol: "eth",
  },
  [ChainIds.zkSyncMainnet]: {
    name: "zkSync",
    chainId: ChainIds.zkSyncMainnet,
    nativeSymbol: "eth",
  },
  [ChainIds.sepolia]: {
    name: "Sepolia",
    chainId: ChainIds.sepolia,
    nativeSymbol: "eth",
  },
  [ChainIds.linea]: {
    name: "Linea",
    chainId: ChainIds.linea,
    nativeSymbol: "eth",
  },
  [ChainIds.lineaGoerli]: {
    name: "Linea Goerli",
    chainId: ChainIds.lineaGoerli,
    nativeSymbol: "eth",
  },
  [ChainIds.mode]: {
    name: "Mode",
    chainId: ChainIds.mode,
    nativeSymbol: "eth",
  },
  [ChainIds.modeTestnet]: {
    name: "Mode Testnet",
    chainId: ChainIds.modeTestnet,
    nativeSymbol: "eth",
  },
  [ChainIds.lisk]: {
    name: "Lisk",
    chainId: ChainIds.lisk,
    nativeSymbol: "eth",
  },
  [ChainIds.liskSepolia]: {
    name: "Lisk Sepolia",
    chainId: ChainIds.liskSepolia,
    nativeSymbol: "eth",
  },
  [ChainIds.blast]: {
    name: "Blast",
    chainId: ChainIds.blast,
    nativeSymbol: "eth",
  },
  [ChainIds.blastSepolia]: {
    name: "Blast Sepolia",
    chainId: ChainIds.blastSepolia,
    nativeSymbol: "eth",
  },
  [ChainIds.scroll]: {
    name: "Scroll",
    chainId: ChainIds.scroll,
    nativeSymbol: "eth",
  },
  [ChainIds.scrollSepolia]: {
    name: "Scroll Sepolia",
    chainId: ChainIds.scrollSepolia,
    nativeSymbol: "eth",
  },
  [ChainIds.redstone]: {
    name: "Redstone",
    chainId: ChainIds.redstone,
    nativeSymbol: "eth",
  },
  [ChainIds.zora]: {
    name: "Zora",
    chainId: ChainIds.zora,
    nativeSymbol: "eth",
  },
  [ChainIds.worldChain]: {
    name: "World Chain",
    chainId: ChainIds.worldChain,
    nativeSymbol: "eth",
  },
  [ChainIds.alephZero]: {
    name: "Aleph Zero",
    chainId: ChainIds.alephZero,
    nativeSymbol: "azero",
  },
  [ChainIds.ink]: {
    name: "Ink",
    chainId: ChainIds.ink,
    nativeSymbol: "eth",
  },
  [ChainIds.cher]: {
    name: "Cher",
    chainId: ChainIds.cher,
    nativeSymbol: "eth",
  },
  [ChainIds.doctorWho]: {
    name: "Doctor Who",
    chainId: ChainIds.doctorWho,
    nativeSymbol: "eth",
  },
};

export const wait = (seconds = 1) =>
  new Promise((res) => {
    setTimeout(res, 1000 * seconds);
  });

export const EnhancedCron = (cronExpression: string) => {
  if (process.env.DISABLE_CRONS != "true") return applyDecorators(Cron(cronExpression));
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

export function assertValidAddress(address: string) {
  try {
    const validAddress = ethers.utils.getAddress(address);
    return validAddress;
  } catch (error) {
    throw new InvalidAddressException();
  }
}
