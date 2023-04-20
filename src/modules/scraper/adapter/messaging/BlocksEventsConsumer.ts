import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import {
  BlockNumberQueueMessage,
  BlocksEventsQueueMessage,
  FillEventsQueueMessage,
  ScraperQueue,
  SpeedUpEventsQueueMessage,
} from ".";
import {
  FundsDepositedEvent,
  FilledRelayEvent,
  RequestedSpeedUpDepositEvent,
} from "@across-protocol/contracts-v2/dist/typechain/SpokePool";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import { RequestedSpeedUpDepositEv, FilledRelayEv, FundsDepositedEv } from "../../../web3/model";

@Processor(ScraperQueue.BlocksEvents)
export class BlocksEventsConsumer {
  private logger = new Logger(BlocksEventsConsumer.name);

  constructor(
    private providers: EthProvidersService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(FundsDepositedEv) private fundsDepositedEvRepository: Repository<FundsDepositedEv>,
    @InjectRepository(FilledRelayEv) private filledRelayEvRepository: Repository<FilledRelayEv>,
    @InjectRepository(RequestedSpeedUpDepositEv)
    private requestedSpeedUpDepositEvRepository: Repository<RequestedSpeedUpDepositEv>,
    private scraperQueuesService: ScraperQueuesService,
  ) {}

  @Process()
  private async process(job: Job<BlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const depositEvents: FundsDepositedEvent[] = await this.providers
      .getSpokePoolEventQuerier(chainId)
      .getFundsDepositEvents(from, to);
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${depositEvents.length} FundsDepositedEvent`);
    const fillEvents: FilledRelayEvent[] = await this.providers
      .getSpokePoolEventQuerier(chainId)
      .getFilledRelayEvents(from, to);
    this.logger.log(`(${from}, ${to}) - chainId ${chainId} - found ${fillEvents.length} FilledRelayEvent`);
    const speedUpEvents: RequestedSpeedUpDepositEvent[] = await this.providers
      .getSpokePoolEventQuerier(chainId)
      .getRequestedSpeedUpDepositEvents(from, to);
    this.logger.log(
      `(${from}, ${to}) - chainId ${chainId} - found ${speedUpEvents.length} RequestedSpeedUpDepositEvent`,
    );

    for (const event of depositEvents) {
      try {
        const deposit = this.fromFundsDepositedEventToDeposit(event);
        const result = await this.depositRepository.insert(deposit);
        await this.scraperQueuesService.publishMessage<BlockNumberQueueMessage>(ScraperQueue.BlockNumber, {
          depositId: result.identifiers[0].id,
        });
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          // Ignore duplicate key value violates unique constraint error.
          this.logger.warn(error);
        } else {
          throw error;
        }
      }

      try {
        await this.insertRawDepositEvent(event);
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          // Ignore duplicate key value violates unique constraint error.
          this.logger.warn(error);
        } else {
          throw error;
        }
      }
    }

    await this.insertRawFillEvents(fillEvents);
    const fillMessages: FillEventsQueueMessage[] = fillEvents.map((e) => ({
      depositId: e.args.depositId,
      originChainId: e.args.originChainId.toNumber(),
      realizedLpFeePct: e.args.realizedLpFeePct.toString(),
      totalFilledAmount: e.args.totalFilledAmount.toString(),
      fillAmount: e.args.fillAmount.toString(),
      transactionHash: e.transactionHash,
      appliedRelayerFeePct: e.args.appliedRelayerFeePct.toString(),
      destinationToken: e.args.destinationToken,
    }));
    await this.scraperQueuesService.publishMessagesBulk<FillEventsQueueMessage>(ScraperQueue.FillEvents, fillMessages);

    await this.insertRawSpeedUpEvents(speedUpEvents);
    const speedUpMessages: SpeedUpEventsQueueMessage[] = speedUpEvents.map((e) => ({
      depositSourceChainId: chainId,
      depositId: e.args.depositId,
      depositor: e.args.depositor,
      depositorSignature: e.args.depositorSignature,
      transactionHash: e.transactionHash,
      blockNumber: e.blockNumber,
      newRelayerFeePct: e.args.newRelayerFeePct.toString(),
    }));
    await this.scraperQueuesService.publishMessagesBulk<SpeedUpEventsQueueMessage>(
      ScraperQueue.SpeedUpEvents,
      speedUpMessages,
    );
  }

  private fromFundsDepositedEventToDeposit(event: FundsDepositedEvent) {
    const { transactionHash, blockNumber } = event;
    const { depositId, originChainId, destinationChainId, amount, originToken, depositor, relayerFeePct, recipient } =
      event.args;

    return this.depositRepository.create({
      depositId,
      sourceChainId: originChainId.toNumber(),
      destinationChainId: destinationChainId.toNumber(),
      status: "pending",
      amount: amount.toString(),
      filled: "0",
      tokenAddr: originToken,
      depositTxHash: transactionHash,
      fillTxs: [],
      blockNumber,
      depositorAddr: depositor,
      recipientAddr: recipient,
      depositRelayerFeePct: relayerFeePct.toString(),
      initialRelayerFeePct: relayerFeePct.toString(),
    });
  }

  private async insertRawDepositEvent(event: FundsDepositedEvent) {
    const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex, args } = event;
    const {
      amount,
      originChainId,
      destinationChainId,
      relayerFeePct,
      depositId,
      quoteTimestamp,
      originToken,
      recipient,
      depositor,
    } = args;
    return this.fundsDepositedEvRepository.insert({
      blockNumber,
      blockHash,
      transactionIndex,
      address,
      transactionHash,
      logIndex,
      args: {
        amount: amount.toString(),
        originChainId: originChainId.toString(),
        destinationChainId: destinationChainId.toString(),
        relayerFeePct: relayerFeePct.toString(),
        depositId,
        quoteTimestamp,
        originToken,
        recipient,
        depositor,
      },
    });
  }

  private async insertRawFillEvents(events: FilledRelayEvent[]) {
    const dbEvents = events.map((event) => {
      const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex, args } = event;
      const {
        amount,
        totalFilledAmount,
        fillAmount,
        repaymentChainId,
        originChainId,
        destinationChainId,
        relayerFeePct,
        appliedRelayerFeePct,
        realizedLpFeePct,
        depositId,
        destinationToken,
        relayer,
        depositor,
        recipient,
        isSlowRelay,
      } = args;

      return this.filledRelayEvRepository.create({
        blockNumber,
        blockHash,
        transactionIndex,
        address,
        transactionHash,
        logIndex,
        args: {
          amount: amount.toString(),
          totalFilledAmount: totalFilledAmount.toString(),
          fillAmount: fillAmount.toString(),
          repaymentChainId: repaymentChainId.toString(),
          originChainId: originChainId.toString(),
          destinationChainId: destinationChainId.toString(),
          relayerFeePct: relayerFeePct.toString(),
          appliedRelayerFeePct: appliedRelayerFeePct.toString(),
          realizedLpFeePct: realizedLpFeePct.toString(),
          depositId,
          destinationToken,
          relayer,
          depositor,
          recipient,
          isSlowRelay,
        },
      });
    });

    for (const event of dbEvents) {
      try {
        await this.filledRelayEvRepository.insert(event);
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          // Ignore duplicate key value violates unique constraint error.
          this.logger.warn(error);
        } else {
          throw error;
        }
      }
    }
  }

  private async insertRawSpeedUpEvents(events: RequestedSpeedUpDepositEvent[]) {
    const dbEvents = events.map((event) => {
      const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex, args } = event;
      const { newRelayerFeePct, depositId, depositor, depositorSignature } = args;

      return this.requestedSpeedUpDepositEvRepository.create({
        blockNumber,
        blockHash,
        transactionIndex,
        address,
        transactionHash,
        logIndex,
        args: {
          newRelayerFeePct: newRelayerFeePct.toString(),
          depositId,
          depositor,
          depositorSignature,
        },
      });
    });

    for (const event of dbEvents) {
      try {
        await this.requestedSpeedUpDepositEvRepository.insert(event);
      } catch (error) {
        if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
          // Ignore duplicate key value violates unique constraint error.
          this.logger.warn(error);
        } else {
          throw error;
        }
      }
    }
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.BlocksEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
