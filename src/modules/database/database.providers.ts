import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { AppConfig } from "../configuration/configuration.service";
import { ProcessedBlock } from "../scraper/model/ProcessedBlock.entity";
import { MerkleDistributorProcessedBlock } from "../scraper/model/MerkleDistributorProcessedBlock.entity";
import { Claim } from "../airdrop/model/claim.entity";
import { Block } from "../web3/model/block.entity";
import { Deposit } from "../deposit/model/deposit.entity";
import { Token } from "../web3/model/token.entity";
import { Transaction } from "../web3/model/transaction.entity";
import { HistoricMarketPrice } from "../market-price/model/historic-market-price.entity";
import { User } from "../user/model/user.entity";
import { WalletRewards } from "../airdrop/model/wallet-rewards.entity";
import { CommunityRewards } from "../airdrop/model/community-rewards.entity";
import { UserWallet } from "../user/model/user-wallet.entity";
import { MerkleDistributorRecipient } from "../airdrop/model/merkle-distributor-recipient.entity";
import { MerkleDistributorWindow } from "../airdrop/model/merkle-distributor-window.entity";
import { DepositsMv } from "../deposit/model/DepositsMv.entity";
import { DepositsFilteredReferrals } from "../referral/model/DepositsFilteredReferrals.entity";
import { DepositReferralStat } from "../deposit/model/deposit-referral-stat.entity";
import { FundsDepositedEv } from "../web3/model/funds-deposited-ev.entity";
import { FilledRelayEv } from "../web3/model/filled-relay-ev.entity";
import { RequestedSpeedUpDepositEv } from "../web3/model/requested-speed-up-deposit-ev.entity";
import { RewardsWindowJob } from "../rewards/model/RewardsWindowJob.entity";
import { ReferralRewardsWindowJobResult } from "../rewards/model/RewardsWindowJobResult.entity";
import { OpReward } from "../rewards/model/op-reward.entity";
import { TransactionReceipt } from "../web3/model/tx-receipt.entity";
import { QueueJobCount } from "../monitoring/model/QueueJobCount.entity";
import { MerkleDistributorClaim } from "../airdrop/model/merkle-distributor-claim.entity";
import { DepositGapCheck } from "../scraper/model/DepositGapCheck.entity";
import { ArbReward } from "../rewards/model/arb-reward.entity";
import { FindMissedFillEventJob } from "../scraper/model/FindMissedFillEventJob.entity";
import { HubPoolProcessedBlock } from "../scraper/model/HubPoolProcessedBlock.entity";
import { SetPoolRebalanceRouteEvent } from "../web3/model/SetPoolRebalanceRouteEvent.entity";
import { RewardedDeposit } from "../rewards/model/RewardedDeposit.entity";

// TODO: Add db entities here
const entities = [
  ProcessedBlock,
  MerkleDistributorProcessedBlock,
  Claim,
  Block,
  Deposit,
  Token,
  Transaction,
  HistoricMarketPrice,
  User,
  WalletRewards,
  CommunityRewards,
  UserWallet,
  MerkleDistributorWindow,
  MerkleDistributorRecipient,
  DepositsMv,
  DepositsFilteredReferrals,
  DepositReferralStat,
  FundsDepositedEv,
  FilledRelayEv,
  RequestedSpeedUpDepositEv,
  RewardsWindowJob,
  ReferralRewardsWindowJobResult,
  OpReward,
  TransactionReceipt,
  QueueJobCount,
  MerkleDistributorClaim,
  DepositGapCheck,
  ArbReward,
  FindMissedFillEventJob,
  HubPoolProcessedBlock,
  SetPoolRebalanceRouteEvent,
  RewardedDeposit,
];

@Injectable()
export class TypeOrmDefaultConfigService implements TypeOrmOptionsFactory {
  constructor(protected readonly config: AppConfig) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "postgres",
      synchronize: false,
      autoLoadEntities: false,
      logging: false,
      entities,
      ...this.config.values.database,
    };
  }
}
