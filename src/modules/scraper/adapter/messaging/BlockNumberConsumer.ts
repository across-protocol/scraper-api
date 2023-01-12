import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import {
  BlockNumberQueueMessage,
  DepositReferralQueueMessage,
  ScraperQueue,
  TokenDetailsQueueMessage,
  SuggestedFeesQueueMessage,
} from ".";
import { Deposit } from "../../model/deposit.entity";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.BlockNumber)
export class BlockNumberConsumer {
  private logger = new Logger(BlockNumberConsumer.name);

  constructor(
    private providers: EthProvidersService,
    private scraperQueuesService: ScraperQueuesService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
  ) {}

  @Process({ concurrency: 50 })
  private async process(job: Job<BlockNumberQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });
    if (!deposit) return;
    const block = await this.providers.getCachedBlock(deposit.sourceChainId, deposit.blockNumber);
    await this.depositRepository.update({ id: deposit.id }, { depositDate: block.date });
    await this.scraperQueuesService.publishMessage<TokenDetailsQueueMessage>(ScraperQueue.TokenDetails, {
      depositId: deposit.id,
    });
    await this.scraperQueuesService.publishMessage<DepositReferralQueueMessage>(ScraperQueue.DepositReferral, {
      depositId: deposit.id,
    });
    await this.scraperQueuesService.publishMessage<SuggestedFeesQueueMessage>(ScraperQueue.SuggestedFees, {
      depositId: deposit.id,
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.BlockNumber} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
