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
  FillEventsQueueMessage2,
  ScraperQueue,
  SpeedUpEventsQueueMessage,
} from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import {
  RequestedSpeedUpDepositEv,
  FilledRelayEv,
  FundsDepositedEv,
  FundsDepositedEvent2,
  FundsDepositedEvent2_5,
  FilledRelayEvent2,
  FilledRelayEvent2_5,
  FilledRelay2EvArgs,
  FilledRelay2_5EvArgs,
  RefundRequestedEvent2_5,
  RefundRequestedEv,
  RequestedSpeedUpDepositEvent2,
  RequestedSpeedUpDepositEvent2_5,
  RequestedSpeedUpDepositEv2Args,
  RequestedSpeedUpDepositEv2_5Args,
} from "../../../web3/model";
import { AppConfig } from "../../../configuration/configuration.service";
import { splitBlockRanges } from "../../utils";
import { Event } from "ethers";

const SPOKE_POOL_VERIFIER_CONTRACT_ADDRESS = "0x269727F088F16E1Aea52Cf5a97B1CD41DAA3f02D";

@Processor(ScraperQueue.BlocksEvents)
export class BlocksEventsConsumer {
  private logger = new Logger(BlocksEventsConsumer.name);

  constructor(
    private providers: EthProvidersService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    @InjectRepository(FundsDepositedEv) private fundsDepositedEvRepository: Repository<FundsDepositedEv>,
    @InjectRepository(FilledRelayEv) private filledRelayEvRepository: Repository<FilledRelayEv>,
    @InjectRepository(FilledRelayEv) private refundRequestedEvRepository: Repository<RefundRequestedEv>,
    @InjectRepository(RequestedSpeedUpDepositEv)
    private requestedSpeedUpDepositEvRepository: Repository<RequestedSpeedUpDepositEv>,
    private scraperQueuesService: ScraperQueuesService,
    private appConfig: AppConfig,
  ) {}

  @Process()
  private async process(job: Job<BlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const spokePoolConfigs = this.appConfig.values.web3.spokePoolContracts[chainId];
    const ascSpokePoolConfigs = spokePoolConfigs.sort((sp1, sp2) =>
      sp1.startBlockNumber < sp2.startBlockNumber ? -1 : 1,
    );
    // Split the block range in case multiple SpokePool contracts need to be queried
    const blocksToQuery = splitBlockRanges(ascSpokePoolConfigs, from, to);
    // Get the events from the SpokePool contracts
    const { depositEvents, fillEvents, refundEvents, speedUpEvents } = await this.getEvents(blocksToQuery, chainId);
    const eventsCount = {
      depositEvents: depositEvents.length,
      fillEvents: fillEvents.length,
      speedUpEvents: speedUpEvents.length,
      refundEvents: refundEvents.length,
    };
    this.logger.log(`${from}-${to} - chainId ${chainId} - ${JSON.stringify(eventsCount)}`);

    await this.processDepositEvents(chainId, depositEvents);
    await this.processFillEvents(chainId, fillEvents);
    await this.processRefundEvents(chainId, refundEvents);
    await this.processSpeedUpEvents(chainId, speedUpEvents);
  }

  private async getEvents(
    blocksToQuery: { from: number; to: number; address: string; acrossVersion: string }[],
    chainId: number,
  ) {
    const depositEvents: Event[] = [];
    const fillEvents: Event[] = [];
    const refundEvents: Event[] = [];
    const speedUpEvents: Event[] = [];

    for (const blocks of blocksToQuery) {
      const promises = [
        this.providers.getSpokePoolEventQuerier(chainId, blocks.address).getFundsDepositEvents(blocks.from, blocks.to),
        this.providers.getSpokePoolEventQuerier(chainId, blocks.address).getFilledRelayEvents(blocks.from, blocks.to),
        this.providers
          .getSpokePoolEventQuerier(chainId, blocks.address)
          .getRequestedSpeedUpDepositEvents(blocks.from, blocks.to),
      ];

      if (blocks.acrossVersion === "2.5") {
        promises.push(
          this.providers
            .getSpokePoolEventQuerier(chainId, blocks.address)
            .getRefundRequestedEvents(blocks.from, blocks.to),
        );
      } else {
        promises.push(
          (() =>
            new Promise((res) => {
              res([]);
            }))(),
        );
      }

      const [depositEventsChunk, fillEventsChunk, speedUpEventsChunk, refundEventsChunk] = await Promise.all(promises);

      depositEvents.push(...depositEventsChunk);
      fillEvents.push(...fillEventsChunk);
      speedUpEvents.push(...speedUpEventsChunk);
      refundEvents.push(...refundEventsChunk);
    }

    return {
      depositEvents,
      fillEvents,
      refundEvents,
      speedUpEvents,
    };
  }

  private async processDepositEvents(chainId: number, events: Event[]) {
    for (const event of events) {
      try {
        const deposit = await this.fromFundsDepositedEventToDeposit(chainId, event);
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
        await this.insertRawDepositEvent(chainId, event);
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

  private async processFillEvents(chainId: number, events: Event[]) {
    await this.insertRawFillEvents(chainId, events);

    for (const event of events) {
      const { address } = event;
      const { acrossVersion } = this.appConfig.values.web3.spokePoolContracts[chainId].filter(
        (contract) => contract.address === address,
      )[0];

      if (acrossVersion === "2") {
        const typedEvent = event as FilledRelayEvent2;
        const message: FillEventsQueueMessage = {
          depositId: typedEvent.args.depositId,
          originChainId: typedEvent.args.originChainId.toNumber(),
          realizedLpFeePct: typedEvent.args.realizedLpFeePct.toString(),
          totalFilledAmount: typedEvent.args.totalFilledAmount.toString(),
          fillAmount: typedEvent.args.fillAmount.toString(),
          transactionHash: typedEvent.transactionHash,
          appliedRelayerFeePct: typedEvent.args.appliedRelayerFeePct.toString(),
          destinationToken: typedEvent.args.destinationToken,
        };
        await this.scraperQueuesService.publishMessage<FillEventsQueueMessage>(ScraperQueue.FillEvents, message);
      } else if (acrossVersion === "2.5") {
        const typedEvent = event as FilledRelayEvent2_5;
        const message: FillEventsQueueMessage2 = {
          depositId: typedEvent.args.depositId,
          originChainId: typedEvent.args.originChainId.toNumber(),
          realizedLpFeePct: typedEvent.args.realizedLpFeePct.toString(),
          totalFilledAmount: typedEvent.args.totalFilledAmount.toString(),
          fillAmount: typedEvent.args.fillAmount.toString(),
          transactionHash: typedEvent.transactionHash,
          relayerFeePct: typedEvent.args.updatableRelayData.relayerFeePct.toString(),
          destinationToken: typedEvent.args.destinationToken,
        };
        await this.scraperQueuesService.publishMessage<FillEventsQueueMessage2>(ScraperQueue.FillEvents2, message);
      }
    }
  }

  private async processRefundEvents(chainId: number, events: Event[]) {
    await this.insertRawRefundEvents(chainId, events);
  }

  private async processSpeedUpEvents(chainId: number, events: Event[]) {
    await this.insertRawSpeedUpEvents(chainId, events);

    for (const event of events) {
      const { address } = event;
      const { acrossVersion } = this.appConfig.values.web3.spokePoolContracts[chainId].filter(
        (contract) => contract.address === address,
      )[0];

      let message: SpeedUpEventsQueueMessage;

      if (acrossVersion === "2") {
        const typedEvent = event as RequestedSpeedUpDepositEvent2;
        message = {
          depositSourceChainId: chainId,
          depositId: typedEvent.args.depositId,
          depositor: typedEvent.args.depositor,
          depositorSignature: typedEvent.args.depositorSignature,
          transactionHash: typedEvent.transactionHash,
          blockNumber: typedEvent.blockNumber,
          newRelayerFeePct: typedEvent.args.newRelayerFeePct.toString(),
        };
      } else if (acrossVersion === "2.5") {
        const typedEvent = event as RequestedSpeedUpDepositEvent2_5;
        message = {
          depositSourceChainId: chainId,
          depositId: typedEvent.args.depositId,
          depositor: typedEvent.args.depositor,
          depositorSignature: typedEvent.args.depositorSignature,
          transactionHash: typedEvent.transactionHash,
          blockNumber: typedEvent.blockNumber,
          newRelayerFeePct: typedEvent.args.newRelayerFeePct.toString(),
          updatedMessage: typedEvent.args.updatedMessage,
          updatedRecipient: typedEvent.args.updatedRecipient,
        };
      }

      if (message) {
        await this.scraperQueuesService.publishMessage<SpeedUpEventsQueueMessage>(ScraperQueue.SpeedUpEvents, message);
      }
    }
  }

  private async fromFundsDepositedEventToDeposit(chainId: number, event: Event) {
    const typedEvent = event as FundsDepositedEvent2 | FundsDepositedEvent2_5;
    const { transactionHash, blockNumber } = typedEvent;
    const { depositId, originChainId, destinationChainId, amount, originToken, depositor, relayerFeePct, recipient } =
      event.args;
    // In some cases the depositor is the txn msg.sender
    let trueDepositor = depositor;

    if (depositor === SPOKE_POOL_VERIFIER_CONTRACT_ADDRESS) {
      const tx = await this.providers.getCachedTransactionReceipt(chainId, transactionHash);
      trueDepositor = tx.from;
    }

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
      depositorAddr: trueDepositor,
      recipientAddr: recipient,
      depositRelayerFeePct: relayerFeePct.toString(),
      initialRelayerFeePct: relayerFeePct.toString(),
    });
  }

  private async insertRawDepositEvent(chainId: number, event: Event) {
    const typedEvent = event as FundsDepositedEvent2 | FundsDepositedEvent2_5;
    const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex, args } = typedEvent;
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
      chainId,
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

  private async insertRawFillEvents(chainId: number, events: Event[]) {
    const dbEvents = events.map((event) => {
      const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex } = event;
      const { acrossVersion } = this.appConfig.values.web3.spokePoolContracts[chainId].filter(
        (contract) => contract.address === address,
      )[0];
      let dbArgs: FilledRelay2EvArgs | FilledRelay2_5EvArgs;

      if (acrossVersion === "2") {
        const typedEvent = event as FilledRelayEvent2;
        const { args } = typedEvent;
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

        dbArgs = {
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
        };
      } else if (acrossVersion === "2.5") {
        const typedEvent = event as FilledRelayEvent2_5;
        const { args } = typedEvent;
        const {
          amount,
          totalFilledAmount,
          fillAmount,
          repaymentChainId,
          originChainId,
          destinationChainId,
          relayerFeePct,
          realizedLpFeePct,
          depositId,
          destinationToken,
          relayer,
          depositor,
          recipient,
          message,
          updatableRelayData,
        } = args;
        dbArgs = {
          amount: amount.toString(),
          totalFilledAmount: totalFilledAmount.toString(),
          fillAmount: fillAmount.toString(),
          repaymentChainId: repaymentChainId.toString(),
          originChainId: originChainId.toString(),
          destinationChainId: destinationChainId.toString(),
          relayerFeePct: relayerFeePct.toString(),
          realizedLpFeePct: realizedLpFeePct.toString(),
          depositId,
          destinationToken,
          relayer,
          depositor,
          recipient,
          message,
          updatableRelayData: {
            recipient: updatableRelayData.recipient,
            message: updatableRelayData.message,
            relayerFeePct: updatableRelayData.relayerFeePct.toString(),
            isSlowRelay: updatableRelayData.isSlowRelay,
            payoutAdjustmentPct: updatableRelayData.payoutAdjustmentPct.toString(),
          },
        };
      }

      return this.filledRelayEvRepository.create({
        blockNumber,
        blockHash,
        transactionIndex,
        address,
        chainId,
        transactionHash,
        logIndex,
        args: dbArgs,
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

  private async insertRawSpeedUpEvents(chainId: number, events: Event[]) {
    const dbEvents = events.map((event) => {
      const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex } = event;
      const { acrossVersion } = this.appConfig.values.web3.spokePoolContracts[chainId].filter(
        (contract) => contract.address === address,
      )[0];
      let dbArgs: RequestedSpeedUpDepositEv2Args | RequestedSpeedUpDepositEv2_5Args;

      if (acrossVersion === "2") {
        const typedEvent = event as RequestedSpeedUpDepositEvent2;
        const { depositId, depositor, depositorSignature, newRelayerFeePct } = typedEvent.args;
        dbArgs = {
          newRelayerFeePct: newRelayerFeePct.toString(),
          depositId,
          depositor,
          depositorSignature,
        };
      } else if (acrossVersion === "2.5") {
        const typedEvent = event as RequestedSpeedUpDepositEvent2_5;
        const { depositId, depositor, depositorSignature, updatedMessage, updatedRecipient, newRelayerFeePct } =
          typedEvent.args;
        dbArgs = {
          depositId,
          depositor,
          depositorSignature,
          updatedMessage,
          updatedRecipient,
          newRelayerFeePct: newRelayerFeePct.toString(),
        };
      }
      return this.requestedSpeedUpDepositEvRepository.create({
        blockNumber,
        blockHash,
        transactionIndex,
        address,
        chainId,
        transactionHash,
        logIndex,
        args: dbArgs,
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

  private async insertRawRefundEvents(chainId: number, events: Event[]) {
    const typedEvents = events as RefundRequestedEvent2_5[];
    const dbEvents = typedEvents.map((event) => {
      const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex, args } = event;
      const {
        relayer,
        refundToken,
        amount,
        originChainId,
        destinationChainId,
        realizedLpFeePct,
        depositId,
        fillBlock,
        previousIdenticalRequests,
      } = args;

      return this.refundRequestedEvRepository.create({
        blockNumber,
        blockHash,
        transactionIndex,
        address,
        chainId,
        transactionHash,
        logIndex,
        args: {
          relayer,
          refundToken,
          amount: amount.toString(),
          originChainId: originChainId.toString(),
          destinationChainId: destinationChainId.toString(),
          realizedLpFeePct: realizedLpFeePct.toString(),
          depositId,
          fillBlock: fillBlock.toString(),
          previousIdenticalRequests: previousIdenticalRequests.toString(),
        },
      });
    });

    for (const event of dbEvents) {
      try {
        await this.refundRequestedEvRepository.insert(event);
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
