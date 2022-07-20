import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Deposit } from "../../scraper/model/deposit.entity";
import BigNumber from "bignumber.js";
import {
  getActiveRefereesCountQuery,
  getReferralsQuery,
  getReferralTransfersQuery,
  getReferralVolumeQuery,
  getReferreeWalletsQuery,
  getTotalReferralRewardsQuery,
} from "./queries";
import { ethers } from "ethers";
import { AppConfig } from "src/modules/configuration/configuration.service";

const REFERRAL_ADDRESS_DELIMITER = "d00dfeeddeadbeef";

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private appConfig: AppConfig,
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
    const result = await this.depositRepository.manager.query(query, [
      address,
      this.appConfig.values.acxUsdPrice,
      limit,
      offset,
    ]);

    return {
      referrals: result.map((item) => ({ ...item, acxRewards: item.acxRewards })),
      pagination: {
        limit,
        offset,
      },
    };
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
}
