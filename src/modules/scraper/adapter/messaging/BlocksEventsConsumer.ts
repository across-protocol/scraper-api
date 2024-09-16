import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, QueryFailedError } from "typeorm";
import { BigNumber, ethers, Event } from "ethers";

import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import {
  BlockNumberQueueMessage,
  BlocksEventsQueueMessage,
  FillEventsQueueMessage,
  FillEventsQueueMessage2,
  FillEventsV3QueueMessage,
  ScraperQueue,
  SpeedUpEventsQueueMessage,
  SpeedUpEventsV3QueueMessage,
} from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { DepositService } from "../../../deposit/service";
import { ScraperQueuesService } from "../../service/ScraperQueuesService";
import {
  FundsDepositedEvent2,
  FundsDepositedEvent2_5,
  FilledRelayEvent2,
  FilledRelayEvent2_5,
  RequestedSpeedUpDepositEvent2,
  RequestedSpeedUpDepositEvent2_5,
  FundsDepositedV3Event,
  FilledV3RelayEvent,
  RequestedSpeedUpV3DepositEvent,
} from "../../../web3/model";
import SwapAndBridgeAbi from "../../../web3/services/abi/SwapAndBridge.json";
import { SwapBeforeBridgeEvent } from "../../../web3/model/swap-and-bridge-events";
import { AppConfig } from "../../../configuration/configuration.service";
import { splitBlockRanges } from "../../utils";
import { AcrossContractsVersion } from "../../../web3/model/across-version";

const SPOKE_POOL_VERIFIER_CONTRACT_ADDRESS = "0x269727F088F16E1Aea52Cf5a97B1CD41DAA3f02D";

@Processor(ScraperQueue.BlocksEvents)
export class BlocksEventsConsumer {
  private logger = new Logger(BlocksEventsConsumer.name);

  constructor(
    private providers: EthProvidersService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private scraperQueuesService: ScraperQueuesService,
    private appConfig: AppConfig,
    private depositService: DepositService,
  ) {}

  @Process({ concurrency: 20 })
  private async process(job: Job<BlocksEventsQueueMessage>) {
    const { chainId, from, to } = job.data;
    const spokePoolConfigs = this.appConfig.values.web3.spokePoolContracts[chainId];
    const ascSpokePoolConfigs = spokePoolConfigs.sort((sp1, sp2) =>
      sp1.startBlockNumber < sp2.startBlockNumber ? -1 : 1,
    );
    // Split the block range in case multiple SpokePool contracts need to be queried
    const blocksToQuery = splitBlockRanges(ascSpokePoolConfigs, from, to);
    // Get the events from the SpokePool contracts
    const { depositEvents, depositV3Events, fillEvents, fillV3Events, speedUpEvents, speedUpV3Events } =
      await this.getEvents(blocksToQuery, chainId);
    const eventsCount = {
      depositEvents: depositEvents.length,
      depositV3Events: depositV3Events.length,
      fillEvents: fillEvents.length,
      fillV3Events: fillV3Events.length,
      speedUpEvents: speedUpEvents.length,
      speedUpV3Events: speedUpV3Events.length,
    };
    this.logger.log(`${from}-${to} - chainId ${chainId} - ${JSON.stringify(eventsCount)}`);

    await this.processDepositEvents(chainId, depositEvents);
    await this.processDepositV3Events(chainId, depositV3Events);
    await this.processFillEvents(chainId, fillEvents);
    await this.processFillEvents(chainId, fillV3Events);
    await this.processSpeedUpEvents(chainId, speedUpEvents);
    await this.processSpeedUpV3Events(chainId, speedUpV3Events);
  }

  private async getEvents(
    blocksToQuery: { from: number; to: number; address: string; acrossVersion: AcrossContractsVersion }[],
    chainId: number,
  ) {
    // TODO: Add all types of events
    const depositEvents: Event[] = [];
    const depositV3Events: Event[] = [];
    const fillEvents: Event[] = [];
    const fillV3Events: Event[] = [];
    const speedUpEvents: Event[] = [];
    const speedUpV3Events: Event[] = [];

    for (const blocks of blocksToQuery) {
      const spokePoolEventQuerier = this.providers.getSpokePoolEventQuerier(chainId, blocks.acrossVersion);
      let depositEventsPromises = [];
      let fillEventsPromises = [];
      let speedUpEventsPromises = [];

      if (blocks.acrossVersion === AcrossContractsVersion.V2) {
        depositEventsPromises = [
          spokePoolEventQuerier.getFundsDepositEvents(blocks.from, blocks.to),
          new Promise((res) => {
            res([]);
          }),
        ];
        fillEventsPromises = [
          spokePoolEventQuerier.getFilledRelayEvents(blocks.from, blocks.to),
          new Promise((res) => {
            res([]);
          }),
        ];
        speedUpEventsPromises = [
          spokePoolEventQuerier.getRequestedSpeedUpDepositEvents(blocks.from, blocks.to),
          new Promise((res) => {
            res([]);
          }),
        ];
      } else if (blocks.acrossVersion === AcrossContractsVersion.V2_5) {
        depositEventsPromises = [
          spokePoolEventQuerier.getFundsDepositEvents(blocks.from, blocks.to),
          new Promise((res) => {
            res([]);
          }),
        ];
        fillEventsPromises = [
          spokePoolEventQuerier.getFilledRelayEvents(blocks.from, blocks.to),
          new Promise((res) => {
            res([]);
          }),
        ];
        speedUpEventsPromises = [
          spokePoolEventQuerier.getRequestedSpeedUpDepositEvents(blocks.from, blocks.to),
          new Promise((res) => {
            res([]);
          }),
        ];
      } else if (blocks.acrossVersion === AcrossContractsVersion.V3) {
        depositEventsPromises = [
          new Promise((res) => {
            res([]);
          }),
          spokePoolEventQuerier.getFundsDepositedV3Events(blocks.from, blocks.to),
        ];
        fillEventsPromises = [
          spokePoolEventQuerier.getFilledRelayEvents(blocks.from, blocks.to),
          spokePoolEventQuerier.getFilledV3RelayEvents(blocks.from, blocks.to),
        ];
        speedUpEventsPromises = [
          new Promise((res) => {
            res([]);
          }),
          spokePoolEventQuerier.getRequestedSpeedUpV3DepositEvents(blocks.from, blocks.to),
        ];
      }
      const promises = [...depositEventsPromises, ...fillEventsPromises, ...speedUpEventsPromises];
      const [
        depositEventsChunk,
        depositV3EventsChunk,
        fillEventsChunk,
        fillV3EventsChunk,
        speedUpEventsChunk,
        speedUpV3EventsChunk,
      ] = await Promise.all(promises);

      depositEvents.push(...depositEventsChunk);
      depositV3Events.push(...depositV3EventsChunk);
      fillEvents.push(...fillEventsChunk);
      fillV3Events.push(...fillV3EventsChunk);
      speedUpEvents.push(...speedUpEventsChunk);
      speedUpV3Events.push(...speedUpV3EventsChunk);
    }

    return {
      depositEvents,
      depositV3Events,
      fillEvents,
      fillV3Events,
      speedUpEvents,
      speedUpV3Events,
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
    }
  }

  private async processDepositV3Events(chainId: number, events: Event[]) {
    const typedEvents = events as FundsDepositedV3Event[];
    const depositEventsByTxHash = typedEvents.reduce((acc, event) => {
      acc[event.transactionHash] = [...(acc[event.transactionHash] || []), event];
      return acc;
    }, {} as Record<string, FundsDepositedV3Event[]>);
    const swapEventsByTxHash: Record<string, SwapBeforeBridgeEvent[]> = {};

    for (const transactionHash of Object.keys(depositEventsByTxHash)) {
      const txReceipt = await this.providers.getCachedTransactionReceipt(chainId, transactionHash);
      const swapBeforeBridgeEvents = this.providers.parseTransactionReceiptLogs(
        txReceipt,
        "SwapBeforeBridge",
        SwapAndBridgeAbi,
      ) as unknown as SwapBeforeBridgeEvent[];
      swapEventsByTxHash[transactionHash] = swapBeforeBridgeEvents;
    }

    for (const transactionHash of Object.keys(depositEventsByTxHash)) {
      const pairs: [FundsDepositedV3Event, SwapBeforeBridgeEvent | undefined][] = [];
      const depositEvents = depositEventsByTxHash[transactionHash].sort((d1, d2) => d1.logIndex - d2.logIndex);
      const swapEvents = swapEventsByTxHash[transactionHash].sort((s1, s2) => s1.logIndex - s2.logIndex);

      for (const depositEvent of depositEvents) {
        const swapEventIndex = swapEvents.findIndex((e) => e.logIndex < depositEvent.logIndex);

        if (swapEventIndex >= 0) {
          pairs.push([depositEvent, swapEvents[swapEventIndex]]);
          swapEvents.splice(swapEventIndex, 1);
        } else {
          pairs.push([depositEvent, undefined]);
        }
      }

      for (const [depositEvent, swapEvent] of pairs) {
        try {
          const deposit = await this.fromFundsDepositedV3EventToDeposit(chainId, depositEvent, swapEvent);
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
      }
    }
  }

  private async processFillEvents(chainId: number, events: Event[]) {
    // await this.insertRawFillEvents(chainId, events);

    for (const event of events) {
      if (event.args.appliedRelayerFeePct) {
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
      } else if (event.args.updatableRelayData) {
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
      } else if (event.args.relayExecutionInfo) {
        const typedEvent = event as FilledV3RelayEvent;
        const message: FillEventsV3QueueMessage = {
          updatedRecipient: typedEvent.args.relayExecutionInfo.updatedRecipient,
          updatedMessage: typedEvent.args.relayExecutionInfo.updatedMessage,
          updatedOutputAmount: typedEvent.args.relayExecutionInfo.updatedOutputAmount.toString(),
          fillType: typedEvent.args.relayExecutionInfo.fillType,
          depositId: typedEvent.args.depositId,
          originChainId: typedEvent.args.originChainId.toNumber(),
          transactionHash: typedEvent.transactionHash,
        };
        await this.scraperQueuesService.publishMessage<FillEventsV3QueueMessage>(ScraperQueue.FillEventsV3, message);
      } else {
        throw new Error("Unknown fill event type");
      }
    }
  }

  private async processSpeedUpEvents(chainId: number, events: Event[]) {
    // await this.insertRawSpeedUpEvents(chainId, events);

    for (const event of events) {
      const { address } = event;
      const { acrossVersion } = this.appConfig.values.web3.spokePoolContracts[chainId].filter(
        (contract) => contract.address === address,
      )[0];

      let message: SpeedUpEventsQueueMessage;

      if (acrossVersion === AcrossContractsVersion.V2) {
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
      } else if (acrossVersion === AcrossContractsVersion.V2_5) {
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

  private async processSpeedUpV3Events(chainId: number, events: Event[]) {
    for (const event of events) {
      const { transactionHash, blockNumber, args } = event as RequestedSpeedUpV3DepositEvent;
      const message: SpeedUpEventsV3QueueMessage = {
        depositSourceChainId: chainId,
        depositId: args.depositId,
        transactionHash,
        blockNumber,
        depositor: args.depositor,
        depositorSignature: args.depositorSignature,
        updatedOutputAmount: args.updatedOutputAmount.toString(),
        updatedRecipient: args.updatedRecipient,
        updatedMessage: args.updatedMessage,
      };

      await this.scraperQueuesService.publishMessage<SpeedUpEventsV3QueueMessage>(
        ScraperQueue.SpeedUpEventsV3,
        message,
      );
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

  private async fromFundsDepositedV3EventToDeposit(
    chainId: number,
    depositEvent: FundsDepositedV3Event,
    swapEvent?: SwapBeforeBridgeEvent,
  ) {
    const { transactionHash, blockNumber } = depositEvent;
    const {
      depositId,
      destinationChainId,
      inputAmount,
      inputToken,
      outputAmount,
      outputToken,
      depositor,
      recipient,
      fillDeadline,
      exclusivityDeadline,
      relayer,
      message,
      quoteTimestamp,
    } = depositEvent.args;
    const wei = BigNumber.from(10).pow(18);
    const feePct = inputAmount.eq(0) ? BigNumber.from(0) : wei.sub(outputAmount.mul(wei).div(inputAmount));
    const txReceipt = await this.providers.getCachedTransactionReceipt(chainId, transactionHash);
    const swapToken = swapEvent ? await this.providers.getCachedToken(chainId, swapEvent.args.swapToken) : undefined;
    const outputTokenAddress =
      outputToken === ethers.constants.AddressZero
        ? await this.depositService.deriveOutputTokenAddress(
            chainId,
            inputToken,
            destinationChainId.toNumber(),
          )
        : outputToken;
    let trueDepositor = depositor;
    let exclusivityDeadlineDate = undefined;

    if (exclusivityDeadline > 0) exclusivityDeadlineDate = new Date(exclusivityDeadline * 1000);
    if (depositor === SPOKE_POOL_VERIFIER_CONTRACT_ADDRESS) {
      trueDepositor = txReceipt.from;
    }

    return this.depositRepository.create({
      depositId,
      sourceChainId: chainId,
      destinationChainId: destinationChainId.toNumber(),
      status: "pending",
      amount: inputAmount.toString(),
      filled: "0",
      tokenAddr: inputToken,
      depositTxHash: transactionHash,
      fillTxs: [],
      blockNumber,
      depositorAddr: trueDepositor,
      recipientAddr: recipient,
      depositRelayerFeePct: feePct.toString(),
      initialRelayerFeePct: feePct.toString(),
      //relayerFeePct = realizedLpFeePct + (gasFeePct + capitalCostFeePct)(old usage of relayerFeePct)
      // v3 properties
      outputAmount: outputAmount.toString(),
      outputTokenAddress,
      fillDeadline: new Date(fillDeadline * 1000),
      quoteTimestamp: new Date(quoteTimestamp * 1000),
      exclusivityDeadline: exclusivityDeadlineDate,
      relayer,
      message,
      // swap event properties
      swapTokenId: swapToken?.id,
      swapTokenAmount: swapEvent?.args.swapTokenAmount.toString(),
      swapTokenAddress: swapEvent?.args.swapToken,
    });
  }

  // private async insertRawDepositEvent(chainId: number, event: Event) {
  //   const typedEvent = event as FundsDepositedEvent2 | FundsDepositedEvent2_5;
  //   const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex, args } = typedEvent;
  //   const {
  //     amount,
  //     originChainId,
  //     destinationChainId,
  //     relayerFeePct,
  //     depositId,
  //     quoteTimestamp,
  //     originToken,
  //     recipient,
  //     depositor,
  //   } = args;

  //   return this.fundsDepositedEvRepository.insert({
  //     blockNumber,
  //     blockHash,
  //     transactionIndex,
  //     address,
  //     chainId,
  //     transactionHash,
  //     logIndex,
  //     args: {
  //       amount: amount.toString(),
  //       originChainId: originChainId.toString(),
  //       destinationChainId: destinationChainId.toString(),
  //       relayerFeePct: relayerFeePct.toString(),
  //       depositId,
  //       quoteTimestamp,
  //       originToken,
  //       recipient,
  //       depositor,
  //     },
  //   });
  // }

  // private async insertRawFillEvents(chainId: number, events: Event[]) {
  //   const dbEvents = events.map((event) => {
  //     const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex } = event;
  //     const { acrossVersion } = this.appConfig.values.web3.spokePoolContracts[chainId].filter(
  //       (contract) => contract.address === address,
  //     )[0];
  //     let dbArgs: FilledRelay2EvArgs | FilledRelay2_5EvArgs;

  //     if (acrossVersion === "2") {
  //       const typedEvent = event as FilledRelayEvent2;
  //       const { args } = typedEvent;
  //       const {
  //         amount,
  //         totalFilledAmount,
  //         fillAmount,
  //         repaymentChainId,
  //         originChainId,
  //         destinationChainId,
  //         relayerFeePct,
  //         appliedRelayerFeePct,
  //         realizedLpFeePct,
  //         depositId,
  //         destinationToken,
  //         relayer,
  //         depositor,
  //         recipient,
  //         isSlowRelay,
  //       } = args;

  //       dbArgs = {
  //         amount: amount.toString(),
  //         totalFilledAmount: totalFilledAmount.toString(),
  //         fillAmount: fillAmount.toString(),
  //         repaymentChainId: repaymentChainId.toString(),
  //         originChainId: originChainId.toString(),
  //         destinationChainId: destinationChainId.toString(),
  //         relayerFeePct: relayerFeePct.toString(),
  //         appliedRelayerFeePct: appliedRelayerFeePct.toString(),
  //         realizedLpFeePct: realizedLpFeePct.toString(),
  //         depositId,
  //         destinationToken,
  //         relayer,
  //         depositor,
  //         recipient,
  //         isSlowRelay,
  //       };
  //     } else if (acrossVersion === "2.5") {
  //       const typedEvent = event as FilledRelayEvent2_5;
  //       const { args } = typedEvent;
  //       const {
  //         amount,
  //         totalFilledAmount,
  //         fillAmount,
  //         repaymentChainId,
  //         originChainId,
  //         destinationChainId,
  //         relayerFeePct,
  //         realizedLpFeePct,
  //         depositId,
  //         destinationToken,
  //         relayer,
  //         depositor,
  //         recipient,
  //         message,
  //         updatableRelayData,
  //       } = args;
  //       dbArgs = {
  //         amount: amount.toString(),
  //         totalFilledAmount: totalFilledAmount.toString(),
  //         fillAmount: fillAmount.toString(),
  //         repaymentChainId: repaymentChainId.toString(),
  //         originChainId: originChainId.toString(),
  //         destinationChainId: destinationChainId.toString(),
  //         relayerFeePct: relayerFeePct.toString(),
  //         realizedLpFeePct: realizedLpFeePct.toString(),
  //         depositId,
  //         destinationToken,
  //         relayer,
  //         depositor,
  //         recipient,
  //         message,
  //         updatableRelayData: {
  //           recipient: updatableRelayData.recipient,
  //           message: updatableRelayData.message,
  //           relayerFeePct: updatableRelayData.relayerFeePct.toString(),
  //           isSlowRelay: updatableRelayData.isSlowRelay,
  //           payoutAdjustmentPct: updatableRelayData.payoutAdjustmentPct.toString(),
  //         },
  //       };
  //     }

  //     return this.filledRelayEvRepository.create({
  //       blockNumber,
  //       blockHash,
  //       transactionIndex,
  //       address,
  //       chainId,
  //       transactionHash,
  //       logIndex,
  //       args: dbArgs,
  //     });
  //   });

  //   for (const event of dbEvents) {
  //     try {
  //       await this.filledRelayEvRepository.insert(event);
  //     } catch (error) {
  //       if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
  //         // Ignore duplicate key value violates unique constraint error.
  //         this.logger.warn(error);
  //       } else {
  //         throw error;
  //       }
  //     }
  //   }
  // }

  // private async insertRawSpeedUpEvents(chainId: number, events: Event[]) {
  //   const dbEvents = events.map((event) => {
  //     const { blockNumber, blockHash, transactionIndex, address, transactionHash, logIndex } = event;
  //     const { acrossVersion } = this.appConfig.values.web3.spokePoolContracts[chainId].filter(
  //       (contract) => contract.address === address,
  //     )[0];
  //     let dbArgs: RequestedSpeedUpDepositEv2Args | RequestedSpeedUpDepositEv2_5Args;

  //     if (acrossVersion === "2") {
  //       const typedEvent = event as RequestedSpeedUpDepositEvent2;
  //       const { depositId, depositor, depositorSignature, newRelayerFeePct } = typedEvent.args;
  //       dbArgs = {
  //         newRelayerFeePct: newRelayerFeePct.toString(),
  //         depositId,
  //         depositor,
  //         depositorSignature,
  //       };
  //     } else if (acrossVersion === "2.5") {
  //       const typedEvent = event as RequestedSpeedUpDepositEvent2_5;
  //       const { depositId, depositor, depositorSignature, updatedMessage, updatedRecipient, newRelayerFeePct } =
  //         typedEvent.args;
  //       dbArgs = {
  //         depositId,
  //         depositor,
  //         depositorSignature,
  //         updatedMessage,
  //         updatedRecipient,
  //         newRelayerFeePct: newRelayerFeePct.toString(),
  //       };
  //     }
  //     return this.requestedSpeedUpDepositEvRepository.create({
  //       blockNumber,
  //       blockHash,
  //       transactionIndex,
  //       address,
  //       chainId,
  //       transactionHash,
  //       logIndex,
  //       args: dbArgs,
  //     });
  //   });

  //   for (const event of dbEvents) {
  //     try {
  //       await this.requestedSpeedUpDepositEvRepository.insert(event);
  //     } catch (error) {
  //       if (error instanceof QueryFailedError && error.driverError?.code === "23505") {
  //         // Ignore duplicate key value violates unique constraint error.
  //         this.logger.warn(error);
  //       } else {
  //         throw error;
  //       }
  //     }
  //   }
  // }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.BlocksEvents} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
