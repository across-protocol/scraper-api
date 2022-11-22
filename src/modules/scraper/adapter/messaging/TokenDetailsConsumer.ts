import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { ScraperQueue, TokenDetailsQueueMessage, TokenPriceQueueMessage } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit } from "../../model/deposit.entity";
import { Repository } from "typeorm";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.TokenDetails)
export class TokenDetailsConsumer {
  private logger = new Logger(TokenDetailsConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private ethProvidersService: EthProvidersService,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process({ concurrency: 10 })
  private async process(job: Job<TokenDetailsQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });
    if (!deposit) return;
    const { sourceChainId, tokenAddr } = deposit;
    const token = await this.ethProvidersService.getCachedToken(sourceChainId, tokenAddr);
    if (!token) throw new Error("Token not found");
    await this.depositRepository.update({ id: deposit.id }, { tokenId: token.id });
    await this.scraperQueuesService.publishMessage<TokenPriceQueueMessage>(ScraperQueue.TokenPrice, {
      depositId,
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TokenDetails} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
