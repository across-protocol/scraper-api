import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, Repository } from "typeorm";
import { ethers } from "ethers";

import { ScraperQueue, TokenDetailsQueueMessage, TokenPriceQueueMessage } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { Token } from "../../../web3/model/token.entity";
import { ChainIds } from "../../../web3/model/ChainId";
import { SetPoolRebalanceRouteEvent } from "../../../web3/model/SetPoolRebalanceRouteEvent.entity";
import { Block } from "../../../web3/model/block.entity";

@Processor(ScraperQueue.TokenDetails)
export class TokenDetailsConsumer {
  private logger = new Logger(TokenDetailsConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(SetPoolRebalanceRouteEvent)
    private rebalanceRouteRepository: Repository<SetPoolRebalanceRouteEvent>,
    @InjectRepository(Block)
    private blockRepository: Repository<Block>,
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
      try {
        if (deposit.outputTokenAddress === ethers.constants.AddressZero) {
          const mainnetBlock = await this.blockRepository.findOne({
            where: {
              chainId: ChainIds.mainnet,
              date: LessThanOrEqual(deposit.depositDate),
            },
            order: { date: "DESC" },
          });
          const inputTokenRebalanceRoute = await this.rebalanceRouteRepository.findOne({
            where: {
              destinationToken: inputToken.address,
              destinationChainId: deposit.sourceChainId,
              blockNumber: LessThanOrEqual(mainnetBlock.blockNumber),
            },
            order: { blockNumber: "DESC" },
          });
          const l1Token = inputTokenRebalanceRoute.l1Token;
          const outputTokenRebalanceRoute = await this.rebalanceRouteRepository.findOne({
            where: {
              l1Token: l1Token,
              destinationChainId: deposit.destinationChainId,
              blockNumber: LessThanOrEqual(mainnetBlock.blockNumber),
            },
            order: { blockNumber: "DESC" },
          });
          outputToken = await this.ethProvidersService.getCachedToken(
            destinationChainId,
            outputTokenRebalanceRoute.destinationToken,
          );
        } else {
          outputToken = await this.ethProvidersService.getCachedToken(destinationChainId, deposit.outputTokenAddress);
        }
      } catch (error) {
        // stop if output token doesn't exist
        if (
          error?.code === "CALL_EXCEPTION" &&
          ["name()", "symbol()", "decimals()"].includes(error?.method)
        ) {
          this.logger.log(`Output token ${destinationChainId} ${deposit.outputTokenAddress} doesn't exist for deposit ${depositId}`);
          return;
        }
        if (error?.code === "CALL_EXCEPTION" && error?.reason?.includes("reverted without a reason")) {
          this.logger.log(`Output token ${destinationChainId} ${deposit.outputTokenAddress} doesn't exist for deposit ${depositId}`);
          return;
        }
        throw error;
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
