import { registerAs } from "@nestjs/config";
import { ChainIds } from "../web3/model/ChainId";

export default registerAs("config", () => {
  return {
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
      executionMode: process.env.EXECUTION_MODE || "normal",
      referralDelimiterStartTimestamp: process.env.REFERRAL_DELIMITER_START_TIMESTAMP
        ? parseInt(process.env.REFERRAL_DELIMITER_START_TIMESTAMP)
        : undefined,
    },
    web3: {
      providers: {
        1: process.env.WEB3_NODE_URL_1,
        10: process.env.WEB3_NODE_URL_10,
        288: process.env.WEB3_NODE_URL_288,
        137: process.env.WEB3_NODE_URL_137,
        42161: process.env.WEB3_NODE_URL_42161,
        // 42: process.env.WEB3_NODE_URL_42,
        // 421611: process.env.WEB3_NODE_URL_421611,
        // 69: process.env.WEB3_NODE_URL_69,
        // 4: process.env.WEB3_NODE_URL_4,
        // 80001: process.env.WEB3_NODE_URL_80001,
        // 5: process.env.WEB3_NODE_URL_5,
      },
      spokePoolContracts: {
        [ChainIds.mainnet]: {
          address: "0x4D9079Bb4165aeb4084c526a32695dCfd2F77381",
          startBlockNumber: 14819486,
        },
        [ChainIds.optimism]: {
          address: "0xa420b2d1c0841415A695b81E5B867BCD07Dff8C9",
          startBlockNumber: 8747136,
        },
        [ChainIds.arbitrum]: {
          address: "0xB88690461dDbaB6f04Dfad7df66B7725942FEb9C",
          startBlockNumber: 12741972,
        },
        [ChainIds.boba]: {
          address: "0xBbc6009fEfFc27ce705322832Cb2068F8C1e0A58",
          startBlockNumber: 619993,
        },
        [ChainIds.polygon]: {
          address: "0x69B5c72837769eF1e7C164Abc6515DcFf217F920",
          startBlockNumber: 28604263,
        },
      },
    },
    acxUsdPrice: 0.1,
    enableSpokePoolsEventsProcessing: process.env.ENABLE_SPOKE_POOLS_EVENTS_PROCESSING === "true",
    enableReferralsMaterializedViewRefresh: process.env.ENABLE_REFERRALS_MATERIALIZED_VIEW_REFRESH === "true",
  };
});
