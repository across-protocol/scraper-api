import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import BigNumber from "bignumber.js";

import { CappedBridgeFeeQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { AcrossContractsVersion } from "../../../web3/model/across-version";
import { DepositService } from "../../../deposit/service";

/**
 * This consumer computes the capped bridge fee percentage used for computing referral rewards
 */
@Processor(ScraperQueue.CappedBridgeFee)
export class CappedBridgeFeeConsumer {
  private logger = new Logger(CappedBridgeFeeConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private depositService: DepositService,
  ) {}

  @Process()
  async process(job: Job<CappedBridgeFeeQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({
      where: { id: depositId },
      relations: ["token", "outputToken", "price", "outputTokenPrice"],
    });
    if (!deposit) return;
    if (deposit.status !== "filled") return;

    const version: AcrossContractsVersion = deposit.outputTokenAddress
      ? AcrossContractsVersion.V3
      : AcrossContractsVersion.V2_5;

    if (version === AcrossContractsVersion.V2_5) {
      return;
    }

    this.retryIfNeeded(deposit);
    await this.computeCappedBridgeFeePct(deposit);
  }

  private async computeCappedBridgeFeePct(deposit: Deposit) {
    const wei = new BigNumber(10).pow(18);
    const {bridgeFeePct} = this.depositService.computeBridgeFeeForV3Deposit(deposit);
    const maxBridgeFeePct = wei.times(0.0012);
    const bridgeFeePctCapped = BigNumber.min(bridgeFeePct, maxBridgeFeePct);
    const positiveBridgeFeePct = BigNumber.max(bridgeFeePctCapped, 0);

    await this.depositRepository.update(
      { id: deposit.id },
      {
        bridgeFeePct: positiveBridgeFeePct.toFixed(0),
      },
    );
  }

  private retryIfNeeded(deposit: Deposit) {
    if (deposit.status !== "filled") throw new Error(`Deposit ${deposit.id} is not filled yet`);
    // Check input token and input token price
    if (!deposit.tokenId) throw new Error(`Deposit ${deposit.id} does not have a token yet`);
    if (!deposit.priceId) throw new Error(`Deposit ${deposit.id} does not have a price yet`);
    if (deposit.priceId && !deposit.price) {
      throw new Error(`Deposit ${deposit.id} does not have a price relation`);
    }
    if (deposit.tokenId && !deposit.token) {
      throw new Error(`Deposit ${deposit.id} does not have a token relation`);
    }

    // Check output token and output token price
    if (!deposit.outputTokenId) {
      throw new Error(`Deposit ${deposit.id} does not have an output token yet`);
    }
    if (!deposit.outputTokenPriceId) {
      throw new Error(`Deposit ${deposit.id} does not have an output token price yet`);
    }
    if (deposit.outputTokenId && !deposit.outputToken) {
      throw new Error(`Deposit ${deposit.id} does not have a token relation`);
    }
    if (deposit.outputTokenPriceId && !deposit.outputTokenPrice) {
      throw new Error(`Deposit ${deposit.id} does not have a price relation`);
    }
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.CappedBridgeFee} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
