import { Injectable, Logger } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { DepositGapCheck } from "../model/DepositGapCheck.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { DepositService } from "../../deposit/service";
import { Deposit } from "../../deposit/model/deposit.entity";
import { ChainIds } from "../../web3/model/ChainId";

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
const MaxDepositIdV2 = {
  [ChainIds.mainnet]: 89186,
  [ChainIds.optimism]: 261927,
  [ChainIds.polygon]: 212598,
  [ChainIds.arbitrum]: 328405,
};
const ACROSS_V2_5_FIRST_DEPOSIT_ID = 1000000;

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
      .orUpdate(["passed", "depositId"], ["originChainId"])
      .execute();
  }

  async getLastDepositThatPassedGapCheck(originChainId: number) {
    return this.depositGapCheckRepository.findOne({
      where: { originChainId, passed: true },
    });
  }

  async getDepositToStartGapCheck(
    chainId: number,
    maxDepositIdV2 = MaxDepositIdV2,
    acrossV2_5FirstDepositId = ACROSS_V2_5_FIRST_DEPOSIT_ID,
  ) {
    const lastDepositGapCheck = await this.getLastDepositThatPassedGapCheck(chainId);

    if (lastDepositGapCheck && lastDepositGapCheck.depositId === maxDepositIdV2[chainId]) {
      return acrossV2_5FirstDepositId;
    }

    return lastDepositGapCheck
      ? lastDepositGapCheck.depositId + 1
      : this.depositService.getFirstDepositIdFromSpokePoolConfig(chainId);
  }

  async checkDepositGaps({
    chainId,
    gapsLimit = DEPOSITS_GAP_DETECTION_LIMIT,
    maxGapSize = MAX_GAP_SIZE,
    maxDepositIdV2 = MaxDepositIdV2,
    acrossV2_5FirstDepositId = ACROSS_V2_5_FIRST_DEPOSIT_ID,
  }: {
    chainId: number;
    gapsLimit?: number;
    maxGapSize?: number;
    maxDepositIdV2?: { [key: number]: number };
    acrossV2_5FirstDepositId?: number;
  }): Promise<CheckDepositGapsResult> {
    const gapIntervals: DepositGapInterval[] = [];
    let gapCheckPassDepositId;
    const lastDeposit = await this.depositRepository.findOne({
      where: { sourceChainId: chainId },
      order: { depositId: "DESC" },
    });

    if (!lastDeposit) return { gapIntervals, lastDepositId: lastDeposit?.depositId, gapCheckPassDepositId };

    const firstDepositId = await this.getDepositToStartGapCheck(chainId, maxDepositIdV2, acrossV2_5FirstDepositId);
    this.logger.debug(`Checking gaps for chainId: ${chainId} from ${firstDepositId} to ${lastDeposit.depositId}`);
    for (let i = firstDepositId; i <= lastDeposit.depositId; i++) {
      const d = await this.depositRepository.findOne({
        where: { sourceChainId: chainId, depositId: i },
        select: ["id"],
      });

      if (d) {
        this.logger.debug(`chainId ${chainId} deposit ${i} found`);
        // console.log(`Deposit ${i} found`);
        if (!gapIntervals.length) gapCheckPassDepositId = i;
        if (gapIntervals.length === gapsLimit) {
          break;
        }
      } else {
        this.logger.debug(`chainId ${chainId} deposit ${i} not found.`);
        // console.log(`Deposit ${i} not found.`);
        if (gapIntervals.length === 0) {
          gapIntervals.push({
            fromDepositId: i,
            toDepositId: i,
          });
        } else {
          let lastInterval = gapIntervals[gapIntervals.length - 1];
          // Insert or extend the last gap interval
          if (
            lastInterval.toDepositId === i - 1 &&
            lastInterval.toDepositId - lastInterval.fromDepositId < maxGapSize - 1
          ) {
            lastInterval.toDepositId = i;
          } else {
            gapIntervals.push({
              fromDepositId: i,
              toDepositId: i,
            });
          }
          this.logger.debug(`chainId ${chainId} number of gaps: ${gapIntervals.length}`);
          // console.log(`gaps: ${JSON.stringify(gapIntervals)}`);
          lastInterval = gapIntervals[gapIntervals.length - 1];
          // If we have reached the limit of gaps and the last gap is the maximum size, we can stop
          if (
            gapIntervals.length === gapsLimit &&
            lastInterval.toDepositId - lastInterval.fromDepositId === maxGapSize - 1
          ) {
            break;
          }
        }
      }
      if (i === maxDepositIdV2[chainId]) {
        i = acrossV2_5FirstDepositId - 1;
      }
    }

    return { gapIntervals, lastDepositId: lastDeposit.depositId, gapCheckPassDepositId };
  }
}
