import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Deposit } from "../../scraper/model/deposit.entity";
import {
  getActiveRefereesCountQuery,
  getReferralsQuery,
  getReferralsTotalQuery,
  getReferralTransfersQuery,
  getReferralVolumeQuery,
  getReferreeWalletsQuery,
  getTotalReferralRewardsQuery,
  getRefreshMaterializedView,
} from "./queries";
import { BigNumber, ethers } from "ethers";
import { AppConfig } from "../../configuration/configuration.service";
import { DepositsMv } from "../../deposit/model/DepositsMv.entity";

const REFERRAL_ADDRESS_DELIMITER = "d00dfeeddeadbeef";

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(DepositsMv) private depositsMvRepository: Repository<DepositsMv>,
    private appConfig: AppConfig,
    private dataSource: DataSource,
  ) {}

  public async getReferralSummary(address: string) {
    const referreeWalletsQuery = getReferreeWalletsQuery();
    const referralTransfersQuery = getReferralTransfersQuery();
    const referralVolumeQuery = getReferralVolumeQuery();
    const totalReferralRewardsQuery = getTotalReferralRewardsQuery();
    const activeRefereesCountQuery = getActiveRefereesCountQuery();
    const [
      referreeWalletsResult,
      transfersResult,
      volumeResult,
      totalReferralRewardsResult,
      activeRefereesCountResult,
    ] = await Promise.all([
      this.depositRepository.query(referreeWalletsQuery, [address]),
      this.depositRepository.query(referralTransfersQuery, [address]),
      this.depositRepository.query(referralVolumeQuery, [address]),
      this.depositRepository.query(totalReferralRewardsQuery, [address, this.appConfig.values.acxUsdPrice]),
      this.depositRepository.query(activeRefereesCountQuery, [address]),
    ]);

    const rewardsAmount = totalReferralRewardsResult[0]?.acxRewards || "0";
    const transfers = parseInt(transfersResult[0].count);
    const referreeWallets = parseInt(referreeWalletsResult[0].count);
    const volume = volumeResult[0].volume || 0;
    const { referralRate, tier } = this.getTierLevelAndBonus(referreeWallets, volume);
    const activeRefereesCount = parseInt(activeRefereesCountResult[0].count);

    return {
      referreeWallets,
      transfers,
      volume,
      referralRate,
      rewardsAmount,
      tier,
      activeRefereesCount,
    };
  }

  public async getReferrals(address: string, limit = 10, offset = 0) {
    const query = getReferralsQuery();
    const totalQuery = getReferralsTotalQuery();
    const [result, totalResult] = await Promise.all([
      this.depositRepository.manager.query(query, [address, this.appConfig.values.acxUsdPrice, limit, offset]),
      this.depositRepository.query(totalQuery, [address]),
    ]);
    const total = parseInt(totalResult[0].count);

    return {
      referrals: result.map((item) => ({ ...item, acxRewards: item.acxRewards })),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  public async createReferralsMerkleDistribution(windowIndex: number, maxDepositDate: Date) {
    const deposits = await this.depositsMvRepository
      .createQueryBuilder("deposit")
      .select("*")
      .where("deposit.rewardsWindowIndex IS NULL")
      .andWhere("deposit.depositDate <= :maxDepositDate", { maxDepositDate })
      .getRawMany();

    const { recipients, rewardsToDeposit } = this.calculateReferralRewards(deposits);

    await this.depositRepository.update(
      { depositId: In(deposits.map((d) => d.depositId)) },
      { rewardsWindowIndex: windowIndex },
    );

    return {
      chainId: this.appConfig.values.web3.merkleDistributor.chainId,
      rewardToken: this.appConfig.values.web3.acx.address,
      windowIndex,
      rewardsToDeposit,
      recipients,
    };
  }

  public async revertReferralsMerkleDistribution(windowIndex: number) {
    await this.depositRepository.update({ rewardsWindowIndex: windowIndex }, { rewardsWindowIndex: null });
  }

  private getTierLevelAndBonus(transfersCount: number, transfersVolumeUsd: number) {
    if (transfersCount >= 20 || transfersVolumeUsd >= 500000) {
      return { referralRate: 0.8, tier: 5 };
    }
    if (transfersCount >= 10 || transfersVolumeUsd >= 250000) {
      return { referralRate: 0.7, tier: 4 };
    }
    if (transfersCount >= 5 || transfersVolumeUsd >= 100000) {
      return { referralRate: 0.6, tier: 3 };
    }
    if (transfersCount >= 3 || transfersVolumeUsd >= 50000) {
      return { referralRate: 0.5, tier: 2 };
    }

    return { referralRate: 0.4, tier: 1 };
  }

  public subtractFunctionArgsFromCallData(data: string) {
    const coder = new ethers.utils.AbiCoder();
    // strip hex method identifier
    const dataNoMethod = ethers.utils.hexDataSlice(data, 4);
    // keep method hex identifier
    const methodHex = data.replace(dataNoMethod.replace("0x", ""), "");
    const decodedData = coder.decode(
      ["address", "address", "uint256", "uint256", "uint64", "uint32"],
      ethers.utils.hexDataSlice(data, 4),
    );
    const encoded = coder.encode(["address", "address", "uint256", "uint256", "uint64", "uint32"], decodedData);
    const fullEncoded = methodHex + encoded.replace("0x", "");
    return data.replace(fullEncoded, "");
  }

  public extractReferralAddressUsingDelimiter(data: string) {
    const referralData = this.subtractFunctionArgsFromCallData(data);

    if (referralData.indexOf(REFERRAL_ADDRESS_DELIMITER) !== -1) {
      const addressIndex = referralData.indexOf(REFERRAL_ADDRESS_DELIMITER) + REFERRAL_ADDRESS_DELIMITER.length;
      const potentialAddress = referralData.slice(addressIndex, addressIndex + 40);

      if (potentialAddress.length === 40) {
        const address = ethers.utils.getAddress(`0x${potentialAddress}`);
        return address;
      }
      return undefined;
    }
    return undefined;
  }

  public extractReferralAddress(data: string) {
    const referralData = this.subtractFunctionArgsFromCallData(data);
    if (referralData.length === 40) {
      try {
        return ethers.utils.getAddress(`0x${referralData}`);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  public refreshMaterializedView() {
    return this.depositRepository.query(getRefreshMaterializedView());
  }

  public calculateReferralRewards(deposits: DepositsMv[]) {
    // Map an address to considered deposits for referral rewards
    const addressToDepositsMap = deposits.reduce((acc: Record<string, DepositsMv[]>, d) => {
      if (d.referralAddress) {
        acc[d.referralAddress] = [...(acc[d.referralAddress] || []), d];
        if (d.depositorAddr !== d.referralAddress) {
          acc[d.depositorAddr] = [...(acc[d.depositorAddr] || []), d];
        }
      }
      return acc;
    }, {});

    let rewardsToDeposit: BigNumber = BigNumber.from(0);
    const recipients: {
      account: string;
      amount: string;
      metadata: {
        amountBreakdown: {
          referralRewards: string;
        };
      };
    }[] = [];

    for (const [address, deposits] of Object.entries(addressToDepositsMap)) {
      const acxRewards = deposits.reduce((sum, d) => {
        const feePct =
          d.depositorAddr === address && d.referralAddress === address ? 1 : d.depositorAddr === address ? 0.25 : 0.75;
        const rewardsInUsd = ethers.utils
          .parseEther(parseFloat(d.bridgeFeeUsd).toFixed(18))
          .mul(feePct * 100)
          .mul(d.referralRate * 100)
          .div(100)
          .mul(d.multiplier);
        const rewardsInAcx = rewardsInUsd.div(ethers.utils.parseEther(this.appConfig.values.acxUsdPrice.toString()));
        return sum.add(rewardsInAcx);
      }, BigNumber.from(0));

      rewardsToDeposit = rewardsToDeposit.add(acxRewards);
      recipients.push({
        account: address,
        amount: acxRewards.toString(),
        metadata: {
          amountBreakdown: {
            referralRewards: acxRewards.toString(),
          },
        },
      });
    }

    return { rewardsToDeposit: rewardsToDeposit.toString(), recipients };
  }
}
