import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { BlocksEventsQueueMessage, FillEventsQueueMessage, ScraperQueue } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit } from "../../model/deposit.entity";
import { LessThan, MoreThan, Repository } from "typeorm";
import { BigNumber } from "bignumber.js";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.FillEvents)
export class FillEventsConsumer {
  private logger = new Logger(FillEventsConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<FillEventsQueueMessage>) {
    const { depositId, originChainId, realizedLpFeePct, totalFilledAmount, transactionHash, fillAmount, isSlowRelay } =
      job.data;
    const deposit = await this.depositRepository.findOne({ where: { sourceChainId: originChainId, depositId } });

    if (!deposit) {
      await this.tryToRefetchDepositEvents(job.data);
      throw new Error("Deposit not found in db");
    }

    if (this.fillTxAlreadyProcessed(deposit, job.data)) {
      this.logger.warn("Fill event already processed");
      return;
    }

    deposit.fillTxs = [
      ...deposit.fillTxs,
      { fillAmount, hash: transactionHash, isSlowRelay, realizedLpFeePct, totalFilledAmount },
    ];
    const bridgeFeePct = this.computeBridgeFee(deposit, job.data);

    if (new BigNumber(deposit.filled).lt(totalFilledAmount)) {
      deposit.filled = totalFilledAmount;
    }

    deposit.status = new BigNumber(deposit.amount).eq(deposit.filled) ? "filled" : "pending";
    deposit.bridgeFeePct = bridgeFeePct.toString();

    await this.depositRepository.save(deposit);
  }

  private computeBridgeFee(deposit: Deposit, fill: FillEventsQueueMessage) {
    const maxBridgeFeePct = new BigNumber(10).pow(18).times(0.0012);
    const validFills = deposit.fillTxs.filter((fill) => !fill.isSlowRelay); // all fills associated with a deposit that are NOT slow fills
    const relayerFeePctChargedToUser = validFills.reduce((cumulativeFee, fill) => {
      const relayerFee = new BigNumber(fill.fillAmount).multipliedBy(deposit.depositRelayerFeePct);
      return relayerFee.plus(cumulativeFee);
    }, new BigNumber(0));
    const blendedRelayerFeePct = relayerFeePctChargedToUser.dividedBy(deposit.amount).decimalPlaces(0, 1);
    const bridgeFeePct = blendedRelayerFeePct.plus(fill.realizedLpFeePct);
    const bridgeFeePctCapped = BigNumber.min(bridgeFeePct, maxBridgeFeePct);

    return bridgeFeePctCapped;
  }

  private fillTxAlreadyProcessed(deposit: Deposit, fill: FillEventsQueueMessage) {
    const { totalFilledAmount, transactionHash } = fill;
    const fillTxIndex = deposit.fillTxs.findIndex(
      (fillTx) => fillTx.hash === transactionHash && fillTx.totalFilledAmount === totalFilledAmount,
    );

    if (fillTxIndex !== -1) {
      return true;
    }

    return false;
  }

  /**
   * If a deposit is not found in a database, but we store newer deposits,
   * then try refetch deposit events around that block number
   */
  private async tryToRefetchDepositEvents(fill: FillEventsQueueMessage) {
    const { originChainId, depositId } = fill;
    const newerDeposit = await this.depositRepository.findOne({
      where: { sourceChainId: originChainId, depositId: MoreThan(depositId) },
      order: { depositId: "asc" },
    });
    const olderDeposit = await this.depositRepository.findOne({
      where: { sourceChainId: originChainId, depositId: LessThan(depositId) },
      order: { depositId: "desc" },
    });

    if (newerDeposit && olderDeposit) {
      const now = new Date();
      const diffMinutes = Math.round((now.getTime() - newerDeposit.createdAt.getTime()) / 60000);
      if (diffMinutes >= 20) {
        await this.scraperQueuesService.publishMessage<BlocksEventsQueueMessage>(ScraperQueue.BlocksEvents, {
          chainId: originChainId,
          from: olderDeposit.blockNumber,
          to: newerDeposit.blockNumber,
        });
      }
    }
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.FillEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
