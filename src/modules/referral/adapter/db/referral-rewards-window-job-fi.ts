import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReferralRewardsWindowJob, ReferralRewardsWindowJobStatus } from "../../model/ReferralRewardsWindowJob.entity";

@Injectable()
export class ReferralRewardsWindowJobFixture {
  public constructor(
    @InjectRepository(ReferralRewardsWindowJob)
    private referralRewardsWindowJobRepository: Repository<ReferralRewardsWindowJob>,
  ) {}

  public insert(depositArgs: Partial<ReferralRewardsWindowJob>) {
    const job = this.referralRewardsWindowJobRepository.create(this.mockClaimEntity(depositArgs));
    return this.referralRewardsWindowJobRepository.save(job);
  }

  public insertMany(args: Partial<ReferralRewardsWindowJob>[]) {
    const createdJobs = this.referralRewardsWindowJobRepository.create(args);
    return this.referralRewardsWindowJobRepository.save(createdJobs);
  }

  public deleteAll() {
    return this.referralRewardsWindowJobRepository.query(
      `truncate table referral_rewards_window_job restart identity cascade`,
    );
  }

  public mockClaimEntity(overrides: Partial<ReferralRewardsWindowJob>): Partial<ReferralRewardsWindowJob> {
    return {
      windowIndex: 1,
      status: ReferralRewardsWindowJobStatus.Initial,
      config: { maxDepositDate: new Date().toISOString() },
      ...overrides,
    };
  }
}
