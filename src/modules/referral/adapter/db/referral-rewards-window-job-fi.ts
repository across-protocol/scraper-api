import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RewardsWindowJob, RewardsWindowJobStatus } from "../../model/ReferralRewardsWindowJob.entity";

@Injectable()
export class ReferralRewardsWindowJobFixture {
  public constructor(
    @InjectRepository(RewardsWindowJob)
    private referralRewardsWindowJobRepository: Repository<RewardsWindowJob>,
  ) {}

  public insert(depositArgs: Partial<RewardsWindowJob>) {
    const job = this.referralRewardsWindowJobRepository.create(this.mockClaimEntity(depositArgs));
    return this.referralRewardsWindowJobRepository.save(job);
  }

  public insertMany(args: Partial<RewardsWindowJob>[]) {
    const createdJobs = this.referralRewardsWindowJobRepository.create(args);
    return this.referralRewardsWindowJobRepository.save(createdJobs);
  }

  public deleteAll() {
    return this.referralRewardsWindowJobRepository.query(`truncate table rewards_window_job restart identity cascade`);
  }

  public mockClaimEntity(overrides: Partial<RewardsWindowJob>): Partial<RewardsWindowJob> {
    return {
      windowIndex: 1,
      status: RewardsWindowJobStatus.Initial,
      config: { maxDepositDate: new Date().toISOString() },
      ...overrides,
    };
  }
}
