import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DateTime } from "luxon";
import { ScraperQueue, TokenPriceQueueMessage } from ".";
import { Deposit } from "../../model/deposit.entity";
import { MarketPriceService } from "../../../market-price/services/service";

@Processor(ScraperQueue.TokenPrice)
export class TokenPriceConsumer {
  private logger = new Logger(TokenPriceConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private marketPriceService: MarketPriceService,
  ) {}

  @Process()
  private async process(job: Job<TokenPriceQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId }, relations: ["token"] });

    if (!deposit) return;
    if (!deposit.tokenId || !deposit.token || !deposit.depositDate) throw new Error("Invalid deposit");
    const previousDate = DateTime.fromISO(deposit.depositDate.toISOString()).minus({ days: 1 }).toJSDate();
    const price = await this.marketPriceService.getCachedHistoricMarketPrice(
      previousDate,
      deposit.token.symbol.toLowerCase(),
    );

    if (!price) throw new Error("Price not found");
    await this.depositRepository.update({ id: depositId }, { priceId: price.id });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TokenPrice} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
