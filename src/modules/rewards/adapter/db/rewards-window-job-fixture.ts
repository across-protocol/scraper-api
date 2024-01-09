import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RewardsType, RewardsWindowJob, RewardsWindowJobStatus } from "../../model/RewardsWindowJob.entity";

@Injectable()
export class RewardsWindowJobFixture {
  public constructor(
    @InjectRepository(RewardsWindowJob)
    private rewardsWindowJobRepository: Repository<RewardsWindowJob>,
  ) {}

  public insert(depositArgs: Partial<RewardsWindowJob>) {
    const job = this.rewardsWindowJobRepository.create(this.mockRewardsWindowJobEntity(depositArgs));
    return this.rewardsWindowJobRepository.save(job);
  }

  public insertMany(args: Partial<RewardsWindowJob>[]) {
    const createdJobs = this.rewardsWindowJobRepository.create(args);
    return this.rewardsWindowJobRepository.save(createdJobs);
  }

  public deleteAll() {
    return this.rewardsWindowJobRepository.query(`truncate table rewards_window_job restart identity cascade`);
  }

  public mockRewardsWindowJobEntity(overrides: Partial<RewardsWindowJob>): Partial<RewardsWindowJob> {
    return {
      windowIndex: 1,
      status: RewardsWindowJobStatus.Initial,
      rewardsType: RewardsType.ReferralRewards,
      config: { maxDepositDate: new Date().toISOString() },
      ...overrides,
    };
  }
}
