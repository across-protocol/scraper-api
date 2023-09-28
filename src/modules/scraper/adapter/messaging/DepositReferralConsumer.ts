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
    // if depositDate field is missing, retry the message as this field is necessary to compute
    // the sticky referral address.
    if (!deposit.depositDate) throw new Error(`depositId ${deposit.id}: wait for depositDate`);

    const { depositTxHash, sourceChainId } = deposit;
    const transaction = await this.ethProvidersService.getCachedTransaction(sourceChainId, depositTxHash);
    const block = await this.ethProvidersService.getCachedBlock(sourceChainId, transaction.blockNumber);
    const blockTimestamp = parseInt((new Date(block.date).getTime() / 1000).toFixed(0));

    if (!transaction) throw new Error("Transaction not found");

    const referralAddress = await this.extractReferralAddress({ blockTimestamp, depositId, transaction });
    this.logger.debug(
      `depositId ${depositId}: update referralAddress and stickyReferralAddress with ${referralAddress}`,
    );
    await this.depositRepository.update(
      { id: deposit.id },
      { referralAddress: referralAddress || null, stickyReferralAddress: referralAddress || null },
    );

    // If the tx data contain a referral address, then the consumer execution is done.
    if (referralAddress) return;

    // if the computation of sticky referral address is configured to be made using a different mechanism or
    // it is disabled, then stop the execution of the consumer
    if (this.appConfig.values.stickyReferralAddressesMechanism !== StickyReferralAddressesMechanism.Queue) {
      return;
    }

    // Check if the depositor made a deposit in the past using a referral address
    const previousDepositWithReferralAddress = await this.depositRepository.findOne({
      where: {
        depositorAddr: deposit.depositorAddr,
        referralAddress: Not(IsNull()),
        depositDate: LessThanOrEqual(deposit.depositDate),
      },
    });
    this.logger.debug(
      `depositId ${depositId}: previousDepositWithReferralAddress ${!!previousDepositWithReferralAddress}`,
    );

    // If the depositor didn't make a deposit in the past using a referral address, then there is no need to
    // compute the sticky referral address and the consumer execution is stopped
    if (!previousDepositWithReferralAddress) return;

    // Compute the sticky referral address for depositor's deposits that don't have a referral address
    // in the tx calldata and made after this deposit
    await this.computeStickyReferralAddress(deposit);
    this.logger.debug(`depositId ${depositId}: done`);
  }

  private async computeStickyReferralAddress(deposit: Deposit) {
    let page = 0;
    const limit = 100;

    while (true) {
      // Make paginated SQL queries to get all deposits without a referral address and made after the processed deposit
      const deposits = await this.depositRepository.find({
        where: {
          depositorAddr: deposit.depositorAddr,
          referralAddress: IsNull(),
          depositDate: MoreThanOrEqual(deposit.depositDate),
        },
        take: limit,
        skip: page * limit,
      });

      for (const d of deposits) {
        // for each deposit d with no referral address, find the last previous deposit with a referral address and set it
        // as the sticky referral address of deposit d
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
        await this.depositRepository.update(
          { id: d.id },
          { stickyReferralAddress: previousDepositWithReferralAddress.referralAddress },
        );
      }

      // if the length of the returned deposits is lower than the limit, we processed all depositor's deposits,
      // else go to the next page
      if (deposits.length < limit) {
        break;
      } else {
        page = page + 1;
      }
    }
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
