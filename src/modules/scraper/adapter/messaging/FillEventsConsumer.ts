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
    const { depositId, originChainId, realizedLpFeePct, totalFilledAmount, transactionHash } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { sourceChainId: originChainId, depositId } });
    if (!deposit) {
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
      throw new Error("Deposit not found in db");
    }

    if (deposit.fillTxs.includes({ hash: transactionHash, totalFilledAmount })) return;

    deposit.realizedLpFeePct = new BigNumber(deposit.realizedLpFeePct).plus(realizedLpFeePct).toString();
    // for referrals, the realized lp fee should be capped at 0.12% * amount
    const maxRealizedLpFeePct = new BigNumber(deposit.amount)
      .multipliedBy(0.0012)
      .decimalPlaces(0, BigNumber.ROUND_DOWN);
    deposit.realizedLpFeePctCapped = BigNumber.min(deposit.realizedLpFeePct, maxRealizedLpFeePct).toString();

    if (new BigNumber(deposit.filled).lt(totalFilledAmount)) {
      deposit.filled = totalFilledAmount;
    }

    deposit.fillTxs = [...deposit.fillTxs, { hash: transactionHash, totalFilledAmount }];
    deposit.status = new BigNumber(deposit.amount).eq(deposit.filled) ? "filled" : "pending";

    await this.depositRepository.save(deposit);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.FillEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
