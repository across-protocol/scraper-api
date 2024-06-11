import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ArbRebateRewardMessage, ScraperQueue } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { ChainIds } from "../../../web3/model/ChainId";
import { ArbRebateService } from "../../../rewards/services/arb-rebate-service";

@Processor(ScraperQueue.ArbRebateReward)
export class ArbRebateRewardConsumer {
  private logger = new Logger(ArbRebateRewardConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private arbRebateService: ArbRebateService,
  ) {}

  @Process()
  private async process(job: Job<ArbRebateRewardMessage>) {
    const { depositPrimaryKey } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositPrimaryKey } });

    if (!deposit) return;
    if (deposit.destinationChainId !== ChainIds.arbitrum) return;

    await this.arbRebateService.createArbRebatesForDeposit(deposit.id);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.ArbRebateReward} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
