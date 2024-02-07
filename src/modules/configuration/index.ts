import { registerAs } from "@nestjs/config";
import { ChainIds } from "../web3/model/ChainId";
import { RunMode } from "../../dynamic-module";
import EthereumSpokePool2Abi from "../web3/services/abi/EthereumSpokePool2.json";
import ArbitrumSpokePool2Abi from "../web3/services/abi/ArbitrumSpokePool2.json";
import OptimismSpokePool2Abi from "../web3/services/abi/OptimismSpokePool2.json";
import PolygonSpokePool2Abi from "../web3/services/abi/PolygonSpokePool2.json";
import BobaSpokePool2Abi from "../web3/services/abi/BobaSpokePool2.json";
import SpokePoolV3Abi from "../web3/services/abi/SpokePoolV3.json";

import GoerliSpokePool2_5Abi from "../web3/services/abi/GoerliSpokePool2_5.json";
import EthereumSpokePool2_5Abi from "../web3/services/abi/EthereumSpokePool2_5.json";
import ArbitrumSpokePool2_5Abi from "../web3/services/abi/ArbitrumSpokePool2_5.json";
import PolygonSpokePool2_5Abi from "../web3/services/abi/PolygonSpokePool2_5.json";
import OptimismSpokePool2_5Abi from "../web3/services/abi/OptimismSpokePool2_5.json";
import { AcrossContractsVersion } from "../web3/model/across-version";

export enum StickyReferralAddressesMechanism {
  Queue = "queue",
  Cron = "cron",
  Disabled = "disabled",
}

export const configValues = () => ({
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_NAME,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
  },
  app: {
    port: parseInt(process.env.PORT, 10),
    referralDelimiterStartTimestamp: process.env.REFERRAL_DELIMITER_START_TIMESTAMP
      ? parseInt(process.env.REFERRAL_DELIMITER_START_TIMESTAMP)
      : undefined,
    disableCrons: process.env.DISABLE_CRONS === "true" || false,
    cacheDuration: {
      distributorProofs: isNaN(parseInt(process.env.DISTRIBUTOR_PROOFS_CACHE_SECONDS_DURATION))
        ? 300
        : parseInt(process.env.DISTRIBUTOR_PROOFS_CACHE_SECONDS_DURATION),
      referralsSummary: isNaN(parseInt(process.env.REFERRALS_SUMMARY_CACHE_SECONDS_DURATION))
        ? 120
        : parseInt(process.env.REFERRALS_SUMMARY_CACHE_SECONDS_DURATION),
    },
    runModes: process.env.RUN_MODES ? (process.env.RUN_MODES.split(",") as RunMode[]) : ([RunMode.Normal] as RunMode[]),
  },
  web3: {
    providers: {
      1: process.env.WEB3_NODE_URL_1,
      10: process.env.WEB3_NODE_URL_10,
      288: process.env.WEB3_NODE_URL_288,
      137: process.env.WEB3_NODE_URL_137,
      42161: process.env.WEB3_NODE_URL_42161,
      421613: process.env.WEB3_NODE_URL_421613,
      5: process.env.WEB3_NODE_URL_5,
      280: process.env.WEB3_NODE_URL_280,
      324: process.env.WEB3_NODE_URL_324,
      8453: process.env.WEB3_NODE_URL_8453,
      84531: process.env.WEB3_NODE_URL_84531,
      11155420: process.env.WEB3_NODE_URL_11155420,
      11155111: process.env.WEB3_NODE_URL_11155111,
    },
    spokePoolContracts: {
      [ChainIds.mainnet]: [
        {
          address: "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381",
          startBlockNumber: 14819486,
          abi: JSON.stringify(EthereumSpokePool2Abi),
          acrossVersion: AcrossContractsVersion.V2,
        },
        {
          address: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
          startBlockNumber: 17125811,
          abi: JSON.stringify(EthereumSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.optimism]: [
        {
          address: "0xa420b2d1c0841415A695b81E5B867BCD07Dff8C9",
          startBlockNumber: 8747136,
          abi: JSON.stringify(OptimismSpokePool2Abi),
          acrossVersion: AcrossContractsVersion.V2,
        },
        {
          address: "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
          startBlockNumber: 94233880,
          abi: JSON.stringify(OptimismSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.arbitrum]: [
        {
          address: "0xB88690461dDbaB6f04Dfad7df66B7725942FEb9C",
          startBlockNumber: 12741972,
          abi: JSON.stringify(ArbitrumSpokePool2Abi),
          acrossVersion: AcrossContractsVersion.V2,
        },
        {
          address: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
          startBlockNumber: 84268970,
          abi: JSON.stringify(ArbitrumSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.boba]: [
        {
          address: "0xBbc6009fEfFc27ce705322832Cb2068F8C1e0A58",
          startBlockNumber: 619993,
          abi: JSON.stringify(BobaSpokePool2Abi),
          acrossVersion: AcrossContractsVersion.V2,
        },
      ],
      [ChainIds.polygon]: [
        {
          address: "0x69B5c72837769eF1e7C164Abc6515DcFf217F920",
          startBlockNumber: 28604263,
          abi: JSON.stringify(PolygonSpokePool2Abi),
          acrossVersion: AcrossContractsVersion.V2,
        },
        {
          address: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
          startBlockNumber: 41954460,
          abi: JSON.stringify(PolygonSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.goerli]: [
        {
          address: "0x063fFa6C9748e3f0b9bA8ee3bbbCEe98d92651f7",
          startBlockNumber: 8824950,
          abi: JSON.stringify(GoerliSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.arbitrumGoerli]: [
        {
          address: "0xD29C85F15DF544bA632C9E25829fd29d767d7978",
          startBlockNumber: 16711650,
          abi: JSON.stringify(GoerliSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.zkSyncTestnet]: [
        {
          address: "0x863859ef502F0Ee9676626ED5B418037252eFeb2",
          startBlockNumber: 5000000,
          abi: JSON.stringify(GoerliSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.zkSyncMainnet]: [
        {
          address: "0xE0B015E54d54fc84a6cB9B666099c46adE9335FF",
          startBlockNumber: 10352565,
          abi: JSON.stringify(EthereumSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.base]: [
        {
          address: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
          startBlockNumber: 2164878,
          abi: JSON.stringify(EthereumSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.baseGoerli]: [
        {
          address: "0x1F5AA71C79ec6a11FC55789ed32dAE3B64d75791",
          startBlockNumber: 7992905,
          abi: JSON.stringify(EthereumSpokePool2_5Abi),
          acrossVersion: AcrossContractsVersion.V2_5,
        },
      ],
      [ChainIds.sepolia]: [
        {
          address: "0x622d59F3dbD28fcFE746E0d2f83ebdC286E89A3c",
          startBlockNumber: 14819486,
          abi: JSON.stringify(SpokePoolV3Abi),
          acrossVersion: AcrossContractsVersion.V3,
        },
      ],
    },
    merkleDistributor: {
      address: process.env.MERKLE_DISTRIBUTOR_ADDRESS || "0xF633b72A4C2Fb73b77A379bf72864A825aD35b6D", // TODO: replace with mainnet
      chainId: Number(process.env.MERKLE_DISTRIBUTOR_CHAIN_ID || "5"),
      referralsStartWindowIndex: Number(process.env.REFERRALS_START_WINDOW_INDEX || "1"),
      startBlockNumber: Number(process.env.MERKLE_DISTRIBUTOR_START_BLOCK || 7884371),
    },
    merkleDistributorContracts: {
      opRewards: {
        chainId: Number(process.env.OP_REWARDS_MERKLE_DISTRIBUTOR_CHAIN_ID),
        address: process.env.OP_REWARDS_MERKLE_DISTRIBUTOR_ADDRESS,
        blockNumber: Number(process.env.OP_REWARDS_MERKLE_DISTRIBUTOR_BLOCK_NUMBER),
      },
    },
    acx: {
      address: process.env.ACX_ADDRESS || "0x40153DdFAd90C49dbE3F5c9F96f2a5B25ec67461", // TODO: replace with mainnet,
    },
  },
  enableSpokePoolsEventsProcessing: process.env.ENABLE_SPOKE_POOLS_EVENTS_PROCESSING === "true",
  /**
   * The chains for which we want to process SpokePool events
   */
  spokePoolsEventsProcessingChainIds: process.env.SPOKE_POOLS_EVENTS_PROCESSING_CHAIN_IDS
    ? process.env.SPOKE_POOLS_EVENTS_PROCESSING_CHAIN_IDS.split(",").map((chainId) => parseInt(chainId))
    : [ChainIds.mainnet, ChainIds.optimism, ChainIds.arbitrum, ChainIds.polygon],
  enableMerkleDistributorEventsProcessing: process.env.ENABLE_MERKLE_DISTRIBUTOR_EVENTS_PROCESSING === "true",
  enableReferralsMaterializedViewRefresh: process.env.ENABLE_REFERRALS_MATERIALIZED_VIEW_REFRESH === "true",
  allowWalletRewardsEdit: process.env.ALLOW_WALLET_REWARDS_EDIT === "true",
  stickyReferralAddressesMechanism: process.env.STICKY_REFERRAL_ADDRESSES_MECHANISM
    ? process.env.STICKY_REFERRAL_ADDRESSES_MECHANISM
    : StickyReferralAddressesMechanism.Disabled,
  followingDistances: process.env.FOLLOWING_DISTANCES
    ? (JSON.parse(process.env.FOLLOWING_DISTANCES) as {
        [chainId: string]: number;
      })
    : {},
  auth: {
    jwtSecret: process.env.JWT_SECRET,
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
  },
  suggestedFees: {
    apiUrl: process.env.SUGGESTED_FEES_API_URL || "https://across.to/api/suggested-fees",
    fallbackThresholdHours: Number(process.env.SUGGESTED_FEES_FALLBACK_THRESHOLD_HOURS || "4"),
    deviationBufferMultiplier: Number(process.env.SUGGESTED_FEES_DEVIATION_BUFFER_MULTIPLIER || "1.25"),
  },
  amplitude: {
    apiKey: process.env.AMPLITUDE_API_KEY,
  },
  rewardPrograms: {
    "op-rebates": {
      rewardToken: {
        address: process.env.OP_REBATES_REWARD_TOKEN_ADDRESS || "0x4200000000000000000000000000000000000042",
        chainId: Number(process.env.OP_REBATES_REWARD_TOKEN_CHAIN_ID || "10"),
      },
      enabled: process.env.OP_REBATES_REWARD_PROGRAM_ENABLED === "true",
      startDate: process.env.OP_REBATES_REWARD_PROGRAM_START_DATE
        ? new Date(process.env.OP_REBATES_REWARD_PROGRAM_START_DATE)
        : undefined,
      endDate: process.env.OP_REBATES_REWARD_PROGRAM_END_DATE
        ? new Date(process.env.OP_REBATES_REWARD_PROGRAM_END_DATE)
        : undefined,
    },
  },
  slack: {
    enabled: process.env.ENABLE_SLACK_BOT === "true",
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
});

export default registerAs("config", () => configValues());
