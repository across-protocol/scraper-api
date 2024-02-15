import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { DepositFilledDateQueueMessage, FillEventsQueueMessage, ScraperQueue } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit, DepositFillTx } from "../../../deposit/model/deposit.entity";
import { Repository } from "typeorm";
import { BigNumber } from "bignumber.js";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";

@Processor(ScraperQueue.FillEvents)
export class FillEventsConsumer {
  private logger = new Logger(FillEventsConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<FillEventsQueueMessage>) {
    const { depositId, originChainId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { sourceChainId: originChainId, depositId } });

    if (!deposit) {
      throw new Error("Deposit not found in db");
    }

    if (this.fillTxAlreadyProcessed(deposit, job.data)) {
      this.logger.warn("Fill event already processed");
      return;
    }

    await this.processFillEventQueueMessage(deposit, job.data);

    this.scraperQueuesService.publishMessage<DepositFilledDateQueueMessage>(ScraperQueue.DepositFilledDate, {
      depositId: deposit.id,
    });
  }

  public async processFillEventQueueMessage(deposit: Deposit, data: FillEventsQueueMessage) {
    const { realizedLpFeePct, totalFilledAmount, transactionHash, fillAmount, appliedRelayerFeePct } = data;

    deposit.fillTxs = [
      ...deposit.fillTxs,
      { fillAmount, hash: transactionHash, realizedLpFeePct, totalFilledAmount, appliedRelayerFeePct },
    ];
    const bridgeFeePct = this.computeBridgeFee(deposit, data);

    if (new BigNumber(deposit.filled).lt(totalFilledAmount)) {
      deposit.filled = totalFilledAmount;
    }

    deposit.status = new BigNumber(deposit.amount).eq(deposit.filled) ? "filled" : "pending";
    deposit.bridgeFeePct = bridgeFeePct.toString();

    await this.depositRepository.update(
      { id: deposit.id },
      {
        fillTxs: deposit.fillTxs,
        filled: deposit.filled,
        status: deposit.status,
        bridgeFeePct: deposit.bridgeFeePct,
      },
    );

    return this.depositRepository.findOne({ where: { id: deposit.id } });
  }

  private computeBridgeFee(deposit: Deposit, fill: FillEventsQueueMessage) {
    if (new BigNumber(deposit.amount).eq(0)) {
      return new BigNumber(0);
    }
    const maxBridgeFeePct = new BigNumber(10).pow(18).times(0.0012);
    const validFills = (deposit.fillTxs as DepositFillTx[]).filter((fill) => fill.appliedRelayerFeePct !== "0"); // all fills associated with a deposit that are NOT slow fills
    const relayerFeeChargedToUser = validFills.reduce((cumulativeFee, fill) => {
      const relayerFee = new BigNumber(fill.fillAmount).multipliedBy(fill.appliedRelayerFeePct);
      return relayerFee.plus(cumulativeFee);
    }, new BigNumber(0));
    const blendedRelayerFeePct = relayerFeeChargedToUser.dividedBy(deposit.amount).decimalPlaces(0, 1);
    const bridgeFeePct = blendedRelayerFeePct.plus(fill.realizedLpFeePct);
    const bridgeFeePctCapped = BigNumber.min(bridgeFeePct, maxBridgeFeePct);

    return bridgeFeePctCapped;
  }

  public fillTxAlreadyProcessed(deposit: Deposit, fill: FillEventsQueueMessage) {
    const { totalFilledAmount, transactionHash } = fill;
    const fillTxIndex = (deposit.fillTxs as DepositFillTx[]).findIndex(
      (fillTx) => fillTx.hash === transactionHash && fillTx.totalFilledAmount === totalFilledAmount,
    );

    if (fillTxIndex !== -1) {
      return true;
    }

    return false;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.FillEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
