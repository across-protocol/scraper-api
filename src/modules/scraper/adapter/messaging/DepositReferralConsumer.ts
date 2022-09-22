import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { IsNull, Not, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { DepositReferralQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../model/deposit.entity";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { AppConfig } from "../../../configuration/configuration.service";
import { ReferralService } from "../../../referral/services/service";
import { ChainIds } from "../../../web3/model/ChainId";
import { StickyReferralAddressesMechanism } from "../../../configuration";
import { updateStickyReferralAddressesForDepositor } from "../../../referral/services/queries";

@Processor(ScraperQueue.DepositReferral)
export class DepositReferralConsumer {
  private logger = new Logger(DepositReferralConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private ethProvidersService: EthProvidersService,
    private referralService: ReferralService,
    private appConfig: AppConfig,
  ) {}

  @Process({ concurrency: 1 })
  private async process(job: Job<DepositReferralQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });
    if (!deposit) return;
    const { depositTxHash, sourceChainId } = deposit;
    const transaction = await this.ethProvidersService.getCachedTransaction(sourceChainId, depositTxHash);
    const block = await this.ethProvidersService.getCachedBlock(sourceChainId, transaction.blockNumber);
    const blockTimestamp = parseInt((new Date(block.date).getTime() / 1000).toFixed(0));

    if (!transaction) throw new Error("Transaction not found");

    const { referralDelimiterStartTimestamp } = this.appConfig.values.app;
    let referralAddress: string | undefined = undefined;

    if (referralDelimiterStartTimestamp && blockTimestamp >= referralDelimiterStartTimestamp) {
      referralAddress = this.referralService.extractReferralAddressUsingDelimiter(transaction.data);
    } else {
      referralAddress = this.referralService.extractReferralAddress(transaction.data);

      if (referralAddress) {
        const nonce = await this.ethProvidersService.getProvider(ChainIds.mainnet).getTransactionCount(referralAddress);
        if (nonce === 0) referralAddress = undefined;
      }
    }

    await this.depositRepository.update({ id: deposit.id }, { referralAddress: referralAddress || null });

    if (this.appConfig.values.stickyReferralAddressesMechanism === StickyReferralAddressesMechanism.Queue) {
      const hasDepositsWithReferrals = await this.depositRepository.findOne({
        where: { depositorAddr: deposit.depositorAddr, referralAddress: Not(IsNull()) },
      });

      if (hasDepositsWithReferrals) {
        await this.depositRepository.query(updateStickyReferralAddressesForDepositor(), [deposit.depositorAddr]);
      }
    }
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.DepositReferral} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
