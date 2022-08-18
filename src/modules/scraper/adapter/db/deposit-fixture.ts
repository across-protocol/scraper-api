import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Deposit } from "../../model/deposit.entity";

@Injectable()
export class DepositFixture {
  public constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {}

  public insertDeposit({
    depositId,
    destinationChainId,
    sourceChainId,
    depositorAddr = "0x",
    amount = "0",
    tokenAddr = "0x",
    depositTxHash = "0x",
    blockNumber = 1,
  }: {
    depositId: number;
    sourceChainId: number;
    destinationChainId: number;
    depositorAddr?: string;
    amount?: string;
    tokenAddr?: string;
    depositTxHash?: string;
    blockNumber?: number;
  }) {
    const deposit = this.depositRepository.create({
      depositId,
      sourceChainId,
      destinationChainId,
      depositorAddr,
      amount,
      tokenAddr,
      depositTxHash,
      blockNumber,
    });
    return this.depositRepository.save(deposit);
  }

  public deleteAllDeposits() {
    return this.depositRepository.query(`truncate table "deposit" restart identity cascade`);
  }
}
