export enum ScraperQueue {
  BlocksEvents = "BlocksEvents",
  FillEvents = "FillEvents",
  BlockNumber = "BlockNumber",
  TokenDetails = "TokenDetails",
  DepositReferral = "DepositReferral",
  TokenPrice = "TokenPrice",
  DepositFilledDate = "DepositFilledDate",
  MerkleDistributorBlocksEvents = "MerkleDistributorBlocksEvents",
}

export type BlocksEventsQueueMessage = {
  chainId: number;
  from: number;
  to: number;
};

export type MerkleDistributorBlocksEventsQueueMessage = {
  chainId: number;
  from: number;
  to: number;
};

export type FillEventsQueueMessage = {
  realizedLpFeePct: string;
  originChainId: number;
  depositId: number;
  totalFilledAmount: string;
  fillAmount: string;
  transactionHash: string;
  appliedRelayerFeePct: string;
};

export type BlockNumberQueueMessage = {
  depositId: number;
};

export type TokenDetailsQueueMessage = {
  depositId: number;
};

export type DepositReferralQueueMessage = {
  depositId: number;
};

export type TokenPriceQueueMessage = {
  depositId: number;
};

export type DepositFilledDateQueueMessage = {
  depositId: number;
};
