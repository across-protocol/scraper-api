import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DateTime } from "luxon";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { DepositFilledDateQueueMessage, ScraperQueue } from ".";
import { Deposit, DepositFillTx } from "../../model/deposit.entity";

@Processor(ScraperQueue.DepositFilledDate)
export class DepositFilledDateConsumer {
  private logger = new Logger(DepositFilledDateConsumer.name);

  constructor(
    private providers: EthProvidersService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
  ) {}

  @Process()
  private async process(job: Job<DepositFilledDateQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });

    if (!deposit) return;
    if (deposit.status !== "filled") return;

    if (!deposit.depositDate) {
      throw new Error("Wait for deposit date");
    }

    const fillTxsWithoutDate = deposit.fillTxs.filter((fillTx) => !fillTx.date).length;

    if (fillTxsWithoutDate > 0) {
      const fillTxsWithDate = await Promise.all(
        deposit.fillTxs.map((fillTx) => this.fillDateForFillTx(deposit.destinationChainId, fillTx)),
      );
      deposit.fillTxs = fillTxsWithDate;
    }

    // sort fill tx by date in desc order
    const sortedFillTx = deposit.fillTxs.sort((tx1, tx2) =>
      DateTime.fromISO(tx1.date) <= DateTime.fromISO(tx2.date) ? 1 : -1,
    );
    const filledDate = new Date(sortedFillTx[0].date);

    if (DateTime.fromJSDate(deposit.depositDate) > DateTime.fromJSDate(filledDate)) {
      return;
    }

    deposit.filledDate = filledDate;
    await this.depositRepository.save(deposit);
  }

  private async fillDateForFillTx(chainId: number, fillTx: DepositFillTx) {
    if (fillTx.date) return fillTx;

    const tx = await this.providers.getCachedTransaction(chainId, fillTx.hash);
    const block = await this.providers.getCachedBlock(chainId, tx.blockNumber);

    return {
      ...fillTx,
      date: new Date(block.date).toISOString(),
    };
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.DepositFilledDate} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
