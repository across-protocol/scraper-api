import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";

import { OpRebateService } from "./op-rebate-service";
import { MarketPriceService } from "../../market-price/services/service";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { AppConfig } from "../../configuration/configuration.service";
import config from "../../configuration/index";
import { Deposit } from "../../deposit/model/deposit.entity";
import { Reward } from "../model/reward.entity";
import { ChainIds } from "../../web3/model/ChainId";
import { HistoricMarketPrice } from "../../market-price/model/historic-market-price.entity";
import { Token } from "../../web3/model/token.entity";

const REWARDS_RECIPIENT = "0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D";
const VALID_DEPOSIT: Deposit = {
  ...new Deposit(),
  destinationChainId: ChainIds.optimism,
  status: "filled",
  depositDate: new Date(Date.now()),
  amount: "1000000",
  bridgeFeePct: "10000000000000000", // 1%
  feeBreakdown: {
    lpFeeUsd: "0",
    lpFeeAmount: "0",
    lpFeePct: "0",
    relayCapitalFeeUsd: "0",
    relayCapitalFeeAmount: "0",
    relayCapitalFeePct: "0",
    relayGasFeeUsd: "0",
    relayGasFeeAmount: "0",
    relayGasFeePct: "0",
    totalBridgeFeeUsd: "0.5224309639404370051689220114924",
    totalBridgeFeePct: "10000000000000000",
    totalBridgeFeeAmount: "0",
  },
  price: {
    ...new HistoricMarketPrice(),
    usd: "1",
  },
  token: {
    ...new Token(),
    symbol: "USDC",
    decimals: 6,
  },
};

describe("OpRebateService", () => {
  let opRebateService: OpRebateService;
  let appConfig: AppConfig;
  let depositRepository: Repository<Deposit>;
  let rewardRepository: Repository<Reward>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OpRebateService,
        {
          provide: getRepositoryToken(Deposit),
          useValue: {
            findOne: jest.fn().mockResolvedValue(VALID_DEPOSIT),
          },
        },
        {
          provide: getRepositoryToken(Reward),
          useValue: {
            findOne: jest.fn().mockResolvedValue(undefined),
            create: jest.fn().mockReturnValue(new Reward()),
            save: jest.fn(),
          },
        },
        {
          provide: MarketPriceService,
          useValue: {
            getCachedHistoricMarketPrice: jest.fn().mockResolvedValue({
              usd: "1",
            }),
          },
        },
        {
          provide: EthProvidersService,
          useValue: {
            getProvider: jest.fn().mockReturnValue({
              getTransaction: jest.fn().mockResolvedValue({
                from: REWARDS_RECIPIENT,
              }),
            }),
            getCachedToken: jest.fn().mockResolvedValue({
              id: 1,
              symbol: "USDC",
              decimals: 6,
            }),
          },
        },
        AppConfig,
        {
          provide: config.KEY,
          useValue: {
            rewardPrograms: {
              "op-rebates": {
                rewardToken: {
                  chainId: ChainIds.optimism,
                  address: "0x4200000000000000000000000000000000000042",
                  symbol: "op",
                },
                enabled: true,
              },
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {},
        },
      ],
    }).compile();

    opRebateService = moduleRef.get(OpRebateService);
    depositRepository = moduleRef.get(getRepositoryToken(Deposit));
    rewardRepository = moduleRef.get(getRepositoryToken(Reward));
    appConfig = moduleRef.get(AppConfig);
  });

  describe("createOpRebatesForDeposit", () => {
    it("should return void if disabled via config", async () => {
      jest.spyOn(appConfig, "values", "get").mockReturnValue({
        ...appConfig.values,
        rewardPrograms: {
          "op-rebates": {
            ...appConfig.values.rewardPrograms["op-rebates"],
            enabled: false,
          },
        },
      });

      const result = await opRebateService.createOpRebatesForDeposit(1);

      expect(result).toBeUndefined();
    });

    it("should return void if no deposit found", async () => {
      jest.spyOn(depositRepository, "findOne").mockResolvedValue(undefined);

      const result = await opRebateService.createOpRebatesForDeposit(1);

      expect(result).toBeUndefined();
    });

    it("should return void if deposit status is pending", async () => {
      jest.spyOn(depositRepository, "findOne").mockResolvedValue({
        ...VALID_DEPOSIT,
        status: "pending",
      });

      const result = await opRebateService.createOpRebatesForDeposit(1);

      expect(result).toBeUndefined();
    });

    it("should return void if destination is not Optimism", async () => {
      jest.spyOn(depositRepository, "findOne").mockResolvedValue({
        ...VALID_DEPOSIT,
        destinationChainId: 1,
      });

      const result = await opRebateService.createOpRebatesForDeposit(1);

      expect(result).toBeUndefined();
    });

    ["price", "token", "depositDate"].forEach((key) => {
      it(`should throw if key '${key}' missing`, async () => {
        jest.spyOn(depositRepository, "findOne").mockResolvedValue({
          ...VALID_DEPOSIT,
          [key]: undefined,
        });

        await expect(opRebateService.createOpRebatesForDeposit(1)).rejects.toThrow();
      });
    });

    it(`should throw if key 'feeBreakdown' is empty object`, async () => {
      jest.spyOn(depositRepository, "findOne").mockResolvedValue({
        ...VALID_DEPOSIT,
        feeBreakdown: {} as any,
      });

      await expect(opRebateService.createOpRebatesForDeposit(1)).rejects.toThrow(/is missing fee breakdown/);
    });

    it("should return void if deposit date is before start of program", async () => {
      jest.spyOn(appConfig, "values", "get").mockReturnValue({
        ...appConfig.values,
        rewardPrograms: {
          "op-rebates": {
            ...appConfig.values.rewardPrograms["op-rebates"],
            startDate: new Date(Date.now() + 10_000),
          },
        },
      });

      const result = await opRebateService.createOpRebatesForDeposit(1);

      expect(result).toBeUndefined();
    });

    it("should return void if deposit date is after end of program", async () => {
      jest.spyOn(appConfig, "values", "get").mockReturnValue({
        ...appConfig.values,
        rewardPrograms: {
          "op-rebates": {
            ...appConfig.values.rewardPrograms["op-rebates"],
            endDate: new Date(Date.now() - 10_000),
          },
        },
      });

      const result = await opRebateService.createOpRebatesForDeposit(1);

      expect(result).toBeUndefined();
    });

    it("should return void if reward already existent", async () => {
      jest.spyOn(rewardRepository, "findOne").mockResolvedValue({
        ...new Reward(),
        recipient: REWARDS_RECIPIENT,
      });

      const result = await opRebateService.createOpRebatesForDeposit(1);

      expect(result).toBeUndefined();
    });

    it("should create reward", async () => {
      await opRebateService.createOpRebatesForDeposit(1);

      expect(rewardRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
