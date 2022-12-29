export enum ScraperQueue {
  BlocksEvents = "BlocksEvents",
  FillEvents = "FillEvents",
  SpeedUpEvents = "SpeedUpEvents",
  BlockNumber = "BlockNumber",
  TokenDetails = "TokenDetails",
  DepositReferral = "DepositReferral",
  TokenPrice = "TokenPrice",
  DepositFilledDate = "DepositFilledDate",
  MerkleDistributorBlocksEvents = "MerkleDistributorBlocksEvents",
  DepositAcxPrice = "DepositAcxPrice",
  SuggestedFees = "SuggestedFees",
  TrackFillEvent = "TrackFillEvent",
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
  destinationToken: string;
};

export type SpeedUpEventsQueueMessage = {
  depositSourceChainId: number;
  depositId: number;
  depositor: string;
  depositorSignature: string;
  transactionHash: string;
  blockNumber: number;
  newRelayerFeePct: string;
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

export type DepositAcxPriceQueueMessage = {
  depositId: number;
};

export type SuggestedFeesQueueMessage = {
  depositId: number;
};

export type TrackFillEventQueueMessage = {
  depositId: number;
  fillTxHash: string;
  destinationToken: string;
};
