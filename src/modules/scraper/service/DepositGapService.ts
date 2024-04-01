import { Injectable, Logger } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { DepositGapCheck } from "../model/DepositGapCheck.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { DepositService } from "../../deposit/service";
import { Deposit } from "../../deposit/model/deposit.entity";

export type DepositGapInterval = {
  fromDepositId: number;
  toDepositId: number;
};

type CheckDepositGapsResult = {
  gapIntervals: DepositGapInterval[];
  gapCheckPassDepositId?: number;
  lastDepositId?: number;
};

const DEPOSITS_GAP_DETECTION_LIMIT = 50;
const MAX_GAP_SIZE = 50;

@Injectable()
export class DepositGapService {
  private readonly logger = new Logger(DepositGapService.name);

  constructor(
    private dataSource: DataSource,
    private depositService: DepositService,
    @InjectRepository(DepositGapCheck) private depositGapCheckRepository: Repository<DepositGapCheck>,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
  ) {}

  async markDepositGapCheckAsPassed(depositId: number, originChainId: number) {
    return this.dataSource
      .createQueryBuilder()
      .insert()
      .into(DepositGapCheck)
      .values({ depositId, originChainId, passed: true })
      .orUpdate(["passed"], ["originChainId", "depositId"])
      .execute();
  }

  async getLastDepositThatPassedGapCheck(originChainId: number) {
    return this.depositGapCheckRepository.findOne({
      where: { originChainId, passed: true },
      order: { depositId: "DESC" },
    });
  }

  async getDepositToStartGapCheck(chainId: number) {
    const lastDepositGapCheck = await this.getLastDepositThatPassedGapCheck(chainId);
    return lastDepositGapCheck
      ? lastDepositGapCheck.depositId + 1
      : this.depositService.getFirstDepositIdFromSpokePoolConfig(chainId);
  }

  async checkDepositGaps({
    chainId,
    gapsLimit = DEPOSITS_GAP_DETECTION_LIMIT,
    maxGapSize = MAX_GAP_SIZE,
  }: {
    chainId: number;
    gapsLimit?: number;
    maxGapSize?: number;
  }): Promise<CheckDepositGapsResult> {
    const gapIntervals: DepositGapInterval[] = [];
    let gapCheckPassDepositId;
    const lastDeposit = await this.depositRepository.findOne({
      where: { sourceChainId: chainId },
      order: { depositId: "DESC" },
    });

    if (!lastDeposit) return { gapIntervals, lastDepositId: lastDeposit?.depositId, gapCheckPassDepositId };

    const firstDepositId = await this.getDepositToStartGapCheck(chainId);
    let gapDetected = false;
    this.logger.debug(`Checking gaps for chainId: ${chainId} from ${firstDepositId} to ${lastDeposit.depositId}`);
    for (let i = firstDepositId; i <= lastDeposit.depositId; i++) {
      const d = await this.depositRepository.findOne({
        where: { sourceChainId: chainId, depositId: i },
        select: ["id"],
      });

      if (d) {
        this.logger.debug(`Deposit ${i} found`);
        if (!gapDetected) {
          gapCheckPassDepositId = i;
        }
        if (gapIntervals.length === gapsLimit) {
          break;
        }
      } else {
        gapDetected = true;

        if (gapIntervals.length === 0) {
          gapIntervals.push({
            fromDepositId: i,
            toDepositId: i,
          });
        } else {
          const lastInterval = gapIntervals[gapIntervals.length - 1];
          if (
            gapIntervals.length === gapsLimit &&
            lastInterval.toDepositId - lastInterval.fromDepositId >= maxGapSize - 1
          ) {
            break;
          } else if (lastInterval.toDepositId - lastInterval.fromDepositId >= maxGapSize - 1) {
            // If the gap is bigger than the maxGapSize, we start a new interval
            gapIntervals.push({
              fromDepositId: i,
              toDepositId: i,
            });
          } else if (lastInterval.toDepositId === i - 1) {
            lastInterval.toDepositId = i;
          } else {
            gapIntervals.push({
              fromDepositId: i,
              toDepositId: i,
            });
          }
        }
        this.logger.debug(`Deposit ${i} not found. Number of gaps: ${gapIntervals.length}`);
      }
    }

    return { gapIntervals, lastDepositId: lastDeposit.depositId, gapCheckPassDepositId };
  }
}
