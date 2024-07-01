import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { DateTime } from "luxon";
import { utils } from "ethers";

import { SuggestedFeesService } from "../across-serverless-api/suggested-fees-service";
import { SuggestedFeesQueueMessage, ScraperQueue } from ".";
import { Deposit } from "../../../deposit/model/deposit.entity";
import { AppConfig } from "../../../configuration/configuration.service";

@Processor(ScraperQueue.SuggestedFees)
export class SuggestedFeesConsumer {
  private logger = new Logger(SuggestedFeesConsumer.name);

  constructor(
    private appConfig: AppConfig,
    private suggestedFeesService: SuggestedFeesService,
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
  ) {}

  @Process({ concurrency: 10 })
  private async process(job: Job<SuggestedFeesQueueMessage>) {
    const { depositId } = job.data;

    const deposit = await this.depositRepository.findOne({
      where: { id: depositId },
    });

    if (!deposit) {
      this.logger.verbose(`${ScraperQueue.SuggestedFees} deposit with id '${depositId}' does not exist in db`);
      return;
    }

    if (!deposit.depositDate) {
      throw new Error(`Deposit with id '${depositId}' needs 'depositDate' entry in order to fetch suggested fees`);
    }

    let suggestedRelayerFeePct: string;

    const diffToNowHours = DateTime.fromJSDate(deposit.depositDate).diffNow().as("hours");
    if (Math.abs(diffToNowHours) >= this.appConfig.values.suggestedFees.fallbackThresholdHours) {
      // Due to the inability to retrieve historic suggested fees, we fallback
      // to 1bp for deposits that were made more than configured hours ago.
      suggestedRelayerFeePct = utils.parseEther("0.0001").toString();
    } else {
      // For deposits that were made tolerable hours ago, we assume somewhat constant suggested fees.
      const suggestedFeesFromApi = await this.suggestedFeesService.getFromApi({
        amount: deposit.amount,
        token: deposit.tokenAddr,
        destinationChainId: deposit.destinationChainId,
        originChainId: deposit.sourceChainId,
      });
      suggestedRelayerFeePct = suggestedFeesFromApi.relayFeePct;
    }

    await this.depositRepository.update({ id: depositId }, { suggestedRelayerFeePct });
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.SuggestedFees} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
