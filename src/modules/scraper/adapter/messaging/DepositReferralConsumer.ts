import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import { DepositReferralQueueMessage, ScraperQueue } from ".";
import { ReferralService } from "../../../referral/services/service";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.DepositReferral)
export class DepositReferralConsumer {
  private logger = new Logger(DepositReferralConsumer.name);

  constructor(
    private referralService: ReferralService,
    @InjectRepository(Deposit) readonly depositRepository: Repository<Deposit>,
    private ethProvidersService: EthProvidersService,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process({ concurrency: 10 })
  private async process(job: Job<DepositReferralQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });

    if (!deposit) return;
    // if depositDate field is missing, throw an error to retry the message as this field
    // is necessary to compute the sticky referral address.
    if (!deposit.depositDate) throw new Error(`depositId ${deposit.id}: wait for depositDate`);

    const { depositTxHash, sourceChainId } = deposit;
    const transaction = await this.ethProvidersService.getCachedTransaction(sourceChainId, depositTxHash);
    const block = await this.ethProvidersService.getCachedBlock(sourceChainId, transaction.blockNumber);
    const blockTimestamp = parseInt((new Date(block.date).getTime() / 1000).toFixed(0));

    if (!transaction) throw new Error("Transaction not found");

    await this.referralService.extractReferralAddressOrComputeStickyReferralAddresses({
      blockTimestamp,
      deposit,
      transactionData: transaction.data,
    });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.DepositReferral} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
