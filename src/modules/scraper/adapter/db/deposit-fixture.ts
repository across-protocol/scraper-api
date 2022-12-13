import { DateTime, Duration } from "luxon";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Deposit, DepositFillTx, TransferStatus } from "../../model/deposit.entity";
import { getRandomInt } from "../../../../utils";

@Injectable()
export class DepositFixture {
  public constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {}

  public insertDeposit(depositArgs: Partial<Deposit>) {
    const deposit = this.depositRepository.create(mockDepositEntity(depositArgs));
    return this.depositRepository.save(deposit);
  }

  public insertManyDeposits(deposits: Partial<Deposit>[]) {
    const createdDeposits = this.depositRepository.create(deposits);
    return this.depositRepository.save(createdDeposits);
  }

  public deleteAllDeposits() {
    return this.depositRepository.query(`truncate table "deposit" restart identity cascade`);
  }
}

export function mockDepositEntity(overrides: Partial<Deposit>) {
  return {
    depositId: getRandomInt(),
    sourceChainId: 1,
    destinationChainId: 1,
    depositDate: new Date(),
    depositorAddr: "0x",
    status: "pending" as TransferStatus,
    amount: "0",
    filled: "0",
    realizedLpFeePct: "0",
    realizedLpFeePctCapped: "0",
    bridgeFeePct: "0",
    tokenAddr: "0x",
    depositTxHash: "0x",
    fillTxs: [] as DepositFillTx[],
    blockNumber: 1,
    acxUsdPrice: "0.1",
    ...overrides,
  };
}

export function mockManyDepositEntities(
  n: number,
  options: Partial<{
    depositIdStartIndex: number;
    overrides: Partial<Deposit>;
  }>,
) {
  const { depositIdStartIndex = 1, overrides } = options;

  return Array(n)
    .fill(0)
    .map((zero, i) =>
      mockDepositEntity({
        depositId: depositIdStartIndex + i,
        depositDate: DateTime.now()
          .minus(Duration.fromObject({ days: n - i }))
          .toJSDate(),
        ...overrides,
      }),
    );
}
