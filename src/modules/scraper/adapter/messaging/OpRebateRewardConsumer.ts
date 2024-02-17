import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { OpRebateRewardMessage, ScraperQueue } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { ChainIds } from "../../../web3/model/ChainId";
import { OpRebateService } from "../../../rewards/services/op-rebate-service";

@Processor(ScraperQueue.OpRebateReward)
export class OpRebateRewardConsumer {
  private logger = new Logger(OpRebateRewardConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private opRebateService: OpRebateService,
  ) {}

  @Process()
  private async process(job: Job<OpRebateRewardMessage>) {
    const { depositPrimaryKey } = job.data;

    const deposit = await this.depositRepository.findOne({ where: { id: depositPrimaryKey } });

    if (!deposit) return;
    if (deposit.destinationChainId !== ChainIds.optimism) return;

    await this.opRebateService.createOpRebatesForDeposit(deposit.id);
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.OpRebateReward} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
