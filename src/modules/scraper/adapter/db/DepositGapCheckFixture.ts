import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { getRandomInt } from "../../../../utils";
import { DepositGapCheck } from "../../model/DepositGapCheck.entity";

@Injectable()
export class DepositGapCheckFixture {
  public constructor(
    @InjectRepository(DepositGapCheck) private depositGapCheckRepository: Repository<DepositGapCheck>,
  ) {}

  public insertDepositGapCheck(depositGapCheckArgs: Partial<DepositGapCheck>) {
    const check = this.depositGapCheckRepository.create(mockDepositGapCheckEntity(depositGapCheckArgs));
    return this.depositGapCheckRepository.save(check);
  }

  public deleteAllDepositGapChecks() {
    return this.depositGapCheckRepository.query(`truncate table "deposit_gap_check" restart identity cascade`);
  }
}

export function mockDepositGapCheckEntity(overrides: Partial<DepositGapCheck>) {
  return {
    originChainId: getRandomInt(),
    depositId: getRandomInt(),
    passed: true,
    ...overrides,
  };
}
