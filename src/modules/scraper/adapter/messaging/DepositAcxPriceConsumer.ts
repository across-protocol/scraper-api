import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DateTime } from "luxon";
import { DepositAcxPriceQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { MarketPriceService } from "../../../market-price/services/service";

@Processor(ScraperQueue.DepositAcxPrice)
export class DepositAcxPriceConsumer {
  private logger = new Logger(DepositAcxPriceConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private marketPriceService: MarketPriceService,
  ) {}

  @Process()
  private async process(job: Job<DepositAcxPriceQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });

    if (!deposit) return;
    if (!deposit.depositDate) throw new Error("Invalid deposit");

    const previousDate = DateTime.fromISO(deposit.depositDate.toISOString()).minus({ days: 1 }).toJSDate();
    const price = await this.marketPriceService.getCachedHistoricMarketPrice(previousDate, "acx");

    if (!price) throw new Error("Price not found");
    await this.depositRepository.update({ id: depositId }, { acxUsdPrice: price.usd });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.DepositAcxPrice} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
