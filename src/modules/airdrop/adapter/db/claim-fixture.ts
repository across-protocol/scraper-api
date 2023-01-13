import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Claim } from "../../model/claim.entity";

@Injectable()
export class ClaimFixture {
  public constructor(@InjectRepository(Claim) private claimRepository: Repository<Claim>) {}

  public insertClaim(depositArgs: Partial<Claim>) {
    const Claim = this.claimRepository.create(this.mockClaimEntity(depositArgs));
    return this.claimRepository.save(Claim);
  }

  public insertManyClaims(args: Partial<Claim>[]) {
    const createdDeposits = this.claimRepository.create(args);
    return this.claimRepository.save(createdDeposits);
  }

  public deleteAllClaims() {
    return this.claimRepository.query(`truncate table claim restart identity cascade`);
  }

  public mockClaimEntity(overrides: Partial<Claim>): Partial<Claim> {
    return {
      caller: "0x",
      accountIndex: 0,
      windowIndex: 1,
      account: "0x",
      rewardToken: "0x",
      blockNumber: 1,
      claimedAt: new Date(),
      ...overrides,
    };
  }
}
