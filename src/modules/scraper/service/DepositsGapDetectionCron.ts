import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, MoreThan, Repository } from "typeorm";

import { EnhancedCron } from "../../../utils";
import { AppConfig } from "../../configuration/configuration.service";
import { Deposit } from "../../deposit/model/deposit.entity";
import { MonitoringService } from "../../monitoring/service";
import { DepositGapInterval, DepositGapService } from "./DepositGapService";

export type DepositGapIntervalWithBlocks = DepositGapInterval & {
  previousKnownDeposit?: { depositId: number; blockNumber: number };
  nextKnownDeposit?: { depositId: number; blockNumber: number };
};

@Injectable()
export class DepositsGapDetectionCron {
  private logger = new Logger(DepositsGapDetectionCron.name);
  private lock = false;

  constructor(
    private appConfig: AppConfig,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private monitoringService: MonitoringService,
    private depositGapService: DepositGapService,
  ) {}

  @EnhancedCron("0 5/10 * * * *")
  async run() {
    try {
      if (this.lock) {
        this.logger.warn("DepositsGapDetectionCron is locked");
        return;
      }
      this.lock = true;

      await this.detectDepositsGap();

      this.lock = false;
    } catch (error) {
      this.logger.error(error);
      this.lock = false;
    }
  }

  private async detectDepositsGap() {
    const chainIds = this.appConfig.values.spokePoolsEventsProcessingChainIds;
    const chainGapIntervals: Record<number, DepositGapInterval[]> = {};

    for (const chainId of chainIds) {
      this.logger.log(`Detecting deposits gap for chainId: ${chainId}`);
      const { gapIntervals, lastDepositId, gapCheckPassDepositId } = await this.depositGapService.checkDepositGaps({
        chainId,
      });
      if (gapCheckPassDepositId) {
        await this.depositGapService.markDepositGapCheckAsPassed(gapCheckPassDepositId, chainId);
      }
      const gapIntervalsWithBlocks = await this.attachBlocksToDepositGaps(gapIntervals, chainId);
      if (gapIntervalsWithBlocks.length > 0) {
        this.logger.log(
          `Detected deposits gap for chainId: ${chainId} (lastDepositId: ${lastDepositId}) ${JSON.stringify(
            gapIntervalsWithBlocks,
          )}`,
        );
        chainGapIntervals[chainId] = gapIntervalsWithBlocks;
      }
    }
    await this.monitoringService.postSlackMessage(this.formatSlackPayload(chainGapIntervals));
  }

  private async attachBlocksToDepositGaps(gapIntervals: DepositGapInterval[], chainId: number) {
    const gapIntervalsWithBlocks: DepositGapIntervalWithBlocks[] = [];

    for (const interval of gapIntervals) {
      const previousKnownDeposit = await this.depositRepository.findOne({
        where: { sourceChainId: chainId, depositId: LessThan(interval.fromDepositId) },
        order: { depositId: "DESC" },
      });
      const nextKnownDeposit = await this.depositRepository.findOne({
        where: { sourceChainId: chainId, depositId: MoreThan(interval.toDepositId) },
        order: { depositId: "ASC" },
      });

      gapIntervalsWithBlocks.push({
        ...interval,
        previousKnownDeposit: previousKnownDeposit
          ? {
              depositId: previousKnownDeposit.depositId,
              blockNumber: previousKnownDeposit.blockNumber,
            }
          : // using null instead of undefined because JSON.stringify will remove undefined values
            null,
        nextKnownDeposit: nextKnownDeposit
          ? {
              depositId: nextKnownDeposit.depositId,
              blockNumber: nextKnownDeposit.blockNumber,
            }
          : // using null instead of undefined because JSON.stringify will remove undefined values
            null,
      });
    }

    return gapIntervalsWithBlocks;
  }

  formatSlackPayload(chainGapIntervals: Record<number, DepositGapIntervalWithBlocks[]>) {
    const text = [];

    for (const chainId of Object.keys(chainGapIntervals)) {
      const gapIntervals: DepositGapIntervalWithBlocks[] = chainGapIntervals[chainId];
      text.push({
        type: "rich_text_section",
        elements: [
          {
            type: "text",
            text: `\n\nChainId ${chainId}`,
            style: {
              bold: true,
            },
          },
        ],
      });
      const bullets = [];
      for (const gapInterval of gapIntervals) {
        bullets.push({
          type: "rich_text_section",
          elements: [
            {
              type: "text",
              text: `deposit id from ${gapInterval.fromDepositId} to ${gapInterval.toDepositId}\n(previous id: ${gapInterval.previousKnownDeposit?.depositId} block: ${gapInterval.previousKnownDeposit?.blockNumber}, next id:${gapInterval.nextKnownDeposit?.depositId} block:${gapInterval.nextKnownDeposit?.blockNumber}`,
            },
          ],
        });
      }
      text.push({
        type: "rich_text_list",
        style: "bullet",
        elements: bullets,
      });
    }
    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Deposit gaps detected :collision:",
            emoji: true,
          },
        },
        {
          type: "rich_text",
          elements: text,
        },
        {
          type: "context",
          elements: [
            {
              type: "plain_text",
              text: `:clock1: ${new Date()}`,
              emoji: true,
            },
          ],
        },
        {
          type: "divider",
        },
      ],
    };

    return payload;
  }
}
