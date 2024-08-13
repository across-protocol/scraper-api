import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { utils } from "@across-protocol/sdk-v2";
import { ethers } from "ethers";
import { CronExpression } from "@nestjs/schedule";

import { Deposit } from "../../deposit/model/deposit.entity";
import { DepositGapInterval } from "./DepositGapService";
import { EthProvidersService } from "../../web3/services/EthProvidersService";
import { AcrossContractsVersion } from "../../web3/model/across-version";
import { FindMissedFillEventJob } from "../model/FindMissedFillEventJob.entity";
import { ScraperQueuesService } from "./ScraperQueuesService";
import { FindMissedFillEventQueueMessage, ScraperQueue } from "../adapter/messaging";
import { EnhancedCron } from "../../../utils";

export type DepositGapIntervalWithBlocks = DepositGapInterval & {
  previousKnownDeposit?: { depositId: number; blockNumber: number };
  nextKnownDeposit?: { depositId: number; blockNumber: number };
};

@Injectable()
export class CheckMissedFillEventsCron {
  private logger = new Logger(CheckMissedFillEventsCron.name);
  private lock = false;

  constructor(
    private ethProvidersService: EthProvidersService,
    private dataSource: DataSource,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @EnhancedCron(CronExpression.EVERY_5_MINUTES)
  async run() {
    try {
      if (this.lock) {
        this.logger.warn("CheckMissedFillEventsCron is locked");
        return;
      }
      this.lock = true;
      await this.detectMissedFillEvents();
      this.lock = false;
    } catch (error) {
      this.logger.error(error);
      this.lock = false;
    }
  }

  private async detectMissedFillEvents() {
    const deposits = await this.dataSource
      .createQueryBuilder()
      .select("d")
      .from(Deposit, "d")
      .leftJoinAndSelect(FindMissedFillEventJob, "j", "j.depositPrimaryKey = d.id")
      .where("d.status = :status", { status: "pending" })
      .andWhere("d.outputTokenAddress is not null")
      .andWhere("d.depositDate <= NOW() - INTERVAL '5 minutes'")
      .andWhere("j.id is null")
      .orderBy("d.depositDate", "DESC")
      .limit(1000)
      .getMany();
    this.logger.verbose(`Found ${deposits.length} deposits to check`);
    const filteredDeposits = deposits.filter((d) => d.outputTokenAddress !== ethers.constants.AddressZero);
    this.logger.verbose(`Found ${filteredDeposits.length} deposits with outputTokenAddress`);
    const depositsByDestinationChainId = filteredDeposits.reduce((acc, deposit) => {
      return {
        ...acc,
        [deposit.destinationChainId]: [...(acc[deposit.destinationChainId] || []), deposit],
      };
    }, {} as Record<number, Deposit[]>);

    for (const chainId of Object.keys(depositsByDestinationChainId)) {
      const depositsStatus = await this.getDepositsContractStatus(
        Number(chainId),
        depositsByDestinationChainId[Number(chainId)],
      );
      const filledDeposits = depositsStatus.filter((d) => d.status === 2).map((d) => d.deposit);
      this.logger.verbose(`Found ${filledDeposits.length} filled deposits on chain ${chainId}`);
      for (const deposit of filledDeposits) {
        const insertResult = await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(FindMissedFillEventJob)
          .values({
            depositPrimaryKey: deposit.id,
            depositId: deposit.depositId,
            depositDate: deposit.depositDate,
            originChainId: deposit.sourceChainId,
            destinationChainId: deposit.destinationChainId,
          })
          .orIgnore()
          .execute();
        this.scraperQueuesService.publishMessage<FindMissedFillEventQueueMessage>(ScraperQueue.FindMissedFillEvent, {
          jobId: insertResult.identifiers[0].id,
        });
      }
    }
  }

  async getDepositsContractStatus(chainId: number, deposits: Deposit[]) {
    const statuses = await utils.fillStatusArray(
      this.ethProvidersService.getSpokePoolEventQueriers()[chainId][AcrossContractsVersion.V3].spokePool,
      deposits.map((deposit) => ({
        originChainId: deposit.sourceChainId,
        depositor: deposit.depositorAddr,
        recipient: deposit.recipientAddr,
        depositId: deposit.depositId,
        inputToken: deposit.tokenAddr,
        inputAmount: ethers.BigNumber.from(deposit.amount),
        outputToken: deposit.outputTokenAddress,
        outputAmount: ethers.BigNumber.from(deposit.outputAmount),
        message: deposit.message,
        fillDeadline: deposit.fillDeadline.getTime() / 1000,
        exclusiveRelayer: deposit.relayer,
        exclusivityDeadline: deposit.exclusivityDeadline ? deposit.exclusivityDeadline.getTime() / 1000 : 0,
      })),
    );
    return deposits.map((deposit, index) => ({
      deposit,
      status: statuses[index],
    }));
  }
}
