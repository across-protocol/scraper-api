import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ethers } from "ethers";

import { ScraperQueue, TokenDetailsQueueMessage, TokenPriceQueueMessage } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { Token } from "../../../web3/model/token.entity";
import { ChainIds } from "../../../web3/model/ChainId";

@Processor(ScraperQueue.TokenDetails)
export class TokenDetailsConsumer {
  private logger = new Logger(TokenDetailsConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(Token) private tokenRepository: Repository<Token>,
    private ethProvidersService: EthProvidersService,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process({ concurrency: 10 })
  private async process(job: Job<TokenDetailsQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });
    if (!deposit) return;
    const { sourceChainId, tokenAddr, destinationChainId } = deposit;
    const inputToken = await this.ethProvidersService.getCachedToken(sourceChainId, tokenAddr);

    if (!inputToken) throw new Error(`Input token not found for deposit ${depositId}`);

    let outputToken: Token | undefined = undefined;

    if (deposit.outputTokenAddress) {
      if (deposit.outputTokenAddress === ethers.constants.AddressZero) {
        let outputTokenSymbol: string;

        if (destinationChainId === ChainIds.base && inputToken.symbol === "USDC") {
          outputTokenSymbol = "USDbC";
        } else if (sourceChainId === ChainIds.base && inputToken.symbol === "USDbC") {
          outputTokenSymbol = "USDC";
        } else {
          outputTokenSymbol = inputToken.symbol;
        }
        outputToken = await this.tokenRepository.findOne({
          where: { chainId: destinationChainId, symbol: outputTokenSymbol },
        });
      } else {
        outputToken = await this.ethProvidersService.getCachedToken(destinationChainId, deposit.outputTokenAddress);
      }
    }

    if (deposit.outputTokenAddress && !outputToken) throw new Error(`Output token not found for deposit ${depositId}`);

    await this.depositRepository.update(
      { id: deposit.id },
      {
        tokenId: inputToken.id,
        outputTokenId: outputToken ? outputToken.id : null,
        outputTokenAddress: outputToken ? outputToken.address : deposit.outputTokenAddress,
      },
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
