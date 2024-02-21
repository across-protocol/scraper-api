import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DateTime } from "luxon";
import { DepositAcxPriceQueueMessage, ScraperQueue, TokenPriceQueueMessage } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { MarketPriceService } from "../../../market-price/services/service";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { HistoricMarketPrice } from "../../../market-price/model/historic-market-price.entity";

@Processor(ScraperQueue.TokenPrice)
export class TokenPriceConsumer {
  private logger = new Logger(TokenPriceConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private marketPriceService: MarketPriceService,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<TokenPriceQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({
      where: { id: depositId },
      relations: ["token", "outputToken"],
    });

    if (!deposit) return;
    if (!deposit.depositDate) throw new Error(`Deposit has no deposit date`);
    if (!deposit.tokenId || !deposit.token) throw new Error(`Deposit has no input token`);
    if (deposit.outputTokenAddress && (!deposit.outputTokenId || !deposit.outputToken))
      throw new Error(`Deposit has no output token`);

    const previousDate = DateTime.fromISO(deposit.depositDate.toISOString()).minus({ days: 1 }).toJSDate();
    const price = await this.marketPriceService.getCachedHistoricMarketPrice(
      previousDate,
      deposit.token.symbol.toLowerCase(),
    );
    let outputTokenPrice: HistoricMarketPrice | undefined = undefined;

    if (deposit.outputToken) {
      outputTokenPrice = await this.marketPriceService.getCachedHistoricMarketPrice(
        previousDate,
        deposit.outputToken.symbol.toLowerCase(),
      );
    }

    if (!price) throw new Error("Price not found");
    if (deposit.outputToken && !outputTokenPrice) throw new Error("Output token price not found");

    await this.depositRepository.update(
      { id: depositId },
      { priceId: price.id, outputTokenPriceId: outputTokenPrice ? outputTokenPrice.id : null },
    );
    this.scraperQueuesService.publishMessage<DepositAcxPriceQueueMessage>(ScraperQueue.DepositAcxPrice, { depositId });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TokenPrice} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
