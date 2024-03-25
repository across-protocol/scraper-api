import { Injectable } from "@nestjs/common";
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

@Injectable()
export class DepositGapService {
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

  async checkDepositGaps(chainId: number, gapsLimit = DEPOSITS_GAP_DETECTION_LIMIT): Promise<CheckDepositGapsResult> {
    const gapIntervals: DepositGapInterval[] = [];
    let gapCheckPassDepositId;
    const lastDeposit = await this.depositRepository.findOne({
      where: { sourceChainId: chainId },
      order: { depositId: "DESC" },
    });

    if (!lastDeposit) return { gapIntervals, lastDepositId: lastDeposit?.depositId, gapCheckPassDepositId };

    const firstDepositId = await this.getDepositToStartGapCheck(chainId);
    let gapDetected = false;

    for (let i = firstDepositId; i <= lastDeposit.depositId; i++) {
      const deposit = await this.depositRepository.findOne({ where: { sourceChainId: chainId, depositId: i } });

      if (deposit) {
        if (!gapDetected) {
          gapCheckPassDepositId = deposit.depositId;
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
          if (lastInterval.toDepositId === i - 1) {
            lastInterval.toDepositId = i;
          } else {
            gapIntervals.push({
              fromDepositId: i,
              toDepositId: i,
            });
          }
        }
      }
    }

    return { gapIntervals, lastDepositId: lastDeposit.depositId, gapCheckPassDepositId };
  }
}
