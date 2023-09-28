import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { IsNull, LessThanOrEqual, MoreThanOrEqual, Not, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { DepositReferralQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { AppConfig } from "../../../configuration/configuration.service";
import { ReferralService } from "../../../referral/services/service";
import { ChainIds } from "../../../web3/model/ChainId";
import { StickyReferralAddressesMechanism } from "../../../configuration";
import { Transaction } from "src/modules/web3/model/transaction.entity";

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
    this.logger.debug(`depositId ${depositId}: start`);
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });

    if (!deposit) return;
    if (!deposit.depositDate) throw new Error(`depositId ${deposit.id}: wait for depositDate`);

    const { depositTxHash, sourceChainId } = deposit;
    const transaction = await this.ethProvidersService.getCachedTransaction(sourceChainId, depositTxHash);
    const block = await this.ethProvidersService.getCachedBlock(sourceChainId, transaction.blockNumber);
    const blockTimestamp = parseInt((new Date(block.date).getTime() / 1000).toFixed(0));

    if (!transaction) throw new Error("Transaction not found");

    const referralAddress = await this.extractReferralAddress({ blockTimestamp, depositId, transaction });
    this.logger.debug(`depositId ${depositId}: update referralAddress and stickyReferralAddress`);
    await this.depositRepository.update(
      { id: deposit.id },
      { referralAddress: referralAddress || null, stickyReferralAddress: referralAddress || null },
    );

    // If the deposit tx data doesn't contain a referral address,
    // look for a referral address that was used in a previous deposit
    if (referralAddress) return;

    if (this.appConfig.values.stickyReferralAddressesMechanism !== StickyReferralAddressesMechanism.Queue) {
      return;
    }

    const hasPreviousDepositsWithReferralAddress = await this.depositRepository.findOne({
      where: {
        depositorAddr: deposit.depositorAddr,
        referralAddress: Not(IsNull()),
        depositDate: LessThanOrEqual(deposit.depositDate),
      },
    });
    this.logger.debug(
      `depositId ${depositId}: hasPreviousDepositsWithReferralAddress ${!!hasPreviousDepositsWithReferralAddress}`,
    );
    if (!hasPreviousDepositsWithReferralAddress) return;

    const deposits = await this.depositRepository.find({
      where: {
        depositorAddr: deposit.depositorAddr,
        referralAddress: IsNull(),
        depositDate: MoreThanOrEqual(deposit.depositDate),
      },
    });

    for (const d of deposits) {
      // for each deposit with no referral address, set the sticky referral address
      const previousDepositWithReferralAddress = await this.depositRepository.findOne({
        where: {
          depositorAddr: deposit.depositorAddr,
          referralAddress: Not(IsNull()),
          depositDate: LessThanOrEqual(deposit.depositDate),
        },
        order: {
          depositDate: "DESC",
        },
      });
      d.stickyReferralAddress = previousDepositWithReferralAddress.referralAddress;
      await this.depositRepository.save(d);
    }

    this.logger.debug(`depositId ${depositId}: done`);
  }

  private async extractReferralAddress({
    blockTimestamp,
    depositId,
    transaction,
  }: {
    blockTimestamp: number;
    depositId: number;
    transaction: Transaction;
  }) {
    const { referralDelimiterStartTimestamp } = this.appConfig.values.app;
    let referralAddress: string | undefined = undefined;

    if (referralDelimiterStartTimestamp && blockTimestamp >= referralDelimiterStartTimestamp) {
      this.logger.debug(`depositId ${depositId}: extractReferralAddressUsingDelimiter`);
      referralAddress = this.referralService.extractReferralAddressUsingDelimiter(transaction.data);
    } else {
      this.logger.debug(`depositId ${depositId}: extractReferralAddress`);
      referralAddress = this.referralService.extractReferralAddress(transaction.data);

      if (referralAddress) {
        const nonce = await this.ethProvidersService.getProvider(ChainIds.mainnet).getTransactionCount(referralAddress);
        if (nonce === 0) referralAddress = undefined;
      }
    }

    return referralAddress;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.DepositReferral} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
