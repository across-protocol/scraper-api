import { DateTime } from "luxon";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, Not } from "typeorm";
import { Deposit } from "../scraper/model/deposit.entity";
@Injectable()
export class DepositService {
  constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {}

  public async getDeposits(status = null, limit = 10, offset = 0) {
    const [deposits, total] = await this.depositRepository.findAndCount({
      where: {
        depositDate: Not(IsNull()),
        status: status || Not(IsNull()),
      },
      skip: offset,
      take: limit,
      order: {
        depositDate: "desc",
      },
    });

    return {
      deposits: deposits.map(formatDeposit),
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }
}

/**
 * Format deposit to entity to match `Transfer` structure from sdk.
 * @param deposit - Deposit entity from db.
 * @returns Formatted deposit entity that matches `Transfer` struct.
 */
export function formatDeposit(deposit: Deposit) {
  return {
    depositId: deposit.depositId,
    depositTime: Math.round(DateTime.fromISO(deposit.createdAt.toISOString()).toSeconds()),
    status: deposit.status,
    filled: deposit.filled,
    sourceChainId: deposit.sourceChainId,
    destinationChainId: deposit.destinationChainId,
    assetAddr: deposit.tokenAddr,
    amount: deposit.amount,
    depositTxHash: deposit.depositTxHash,
    fillTxs: deposit.fillTxs.map(({ hash }) => hash),
  };
}
