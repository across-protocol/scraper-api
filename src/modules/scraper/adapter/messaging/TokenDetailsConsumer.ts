import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ScraperQueue, TokenDetailsQueueMessage, TokenPriceQueueMessage } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { Token } from "../../../web3/model/token.entity";

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
    const { sourceChainId, tokenAddr, destinationChainId, outputTokenAddress } = deposit;
    const inputToken = await this.ethProvidersService.getCachedToken(sourceChainId, tokenAddr);
    let outputToken: Token | undefined = undefined;

    if (outputTokenAddress === "0x0000000000000000000000000000000000000000") return;
    if (outputTokenAddress) {
      outputToken = await this.ethProvidersService.getCachedToken(destinationChainId, outputTokenAddress);
    }

    if (!inputToken) throw new Error(`Input token not found for deposit ${depositId}`);
    if (outputTokenAddress && !outputToken) throw new Error(`Output token not found for deposit ${depositId}`);

    await this.depositRepository.update(
      { id: deposit.id },
      { tokenId: inputToken.id, outputTokenId: outputToken ? outputToken.id : null },
    );
    await this.scraperQueuesService.publishMessage<TokenPriceQueueMessage>(ScraperQueue.TokenPrice, {
      depositId,
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.TokenDetails} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
