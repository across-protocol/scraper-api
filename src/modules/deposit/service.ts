import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, Not } from "typeorm";
import { Deposit } from "../scraper/model/deposit.entity";

@Injectable()
export class DepositService {
  constructor(@InjectRepository(Deposit) private depositRepository: Repository<Deposit>) {}

  public async getDeposits(status = null, limit = 10, offset = 0) {
    const where = {
      depositDate: Not(IsNull()),
      status: status || Not(IsNull()),
    };

    const [deposits, total] = await Promise.all([
      this.depositRepository.find({
        where,
        take: limit,
        skip: offset,
        order: {
          depositDate: "desc",
        },
      }),
      this.depositRepository.count({ where }),
    ]);

    return {
      deposits,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }
}
