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
}
