import { OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import { DepositReferralQueueMessage, ScraperQueue } from ".";
import { InjectRepository } from "@nestjs/typeorm";
import { Deposit } from "../../model/deposit.entity";
import { Repository } from "typeorm";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { ethers } from "ethers";

@Processor(ScraperQueue.DepositReferral)
export class DepositReferralConsumer {
  private logger = new Logger(DepositReferralConsumer.name);

  constructor(
    @InjectRepository(Deposit) private depositRepository: Repository<Deposit>,
    private ethProvidersService: EthProvidersService,
  ) {}

  @Process({ concurrency: 10 })
  private async process(job: Job<DepositReferralQueueMessage>) {
    const { depositId } = job.data;
    const deposit = await this.depositRepository.findOne({ where: { id: depositId } });
    if (!deposit) throw new Error("Deposit not found");
    const { depositTxHash, sourceChainId } = deposit;
    const transaction = await this.ethProvidersService.getCachedTransaction(sourceChainId, depositTxHash);

    if (!transaction) throw new Error("Transaction not found");
    const referralAddress = this.extractReferralAddress(transaction.data);
    await this.depositRepository.update({ id: deposit.id }, { referralAddress });
  }

  private extractReferralAddress(data: string) {
    const coder = new ethers.utils.AbiCoder();
    // strip hex method identifier
    const dataNoMethod = ethers.utils.hexDataSlice(data, 4);
    // keep method hex identifier
    const methodHex = data.replace(dataNoMethod.replace("0x", ""), "");
    const decodedData = coder.decode(
      ["address", "address", "uint256", "uint256", "uint64", "uint32"],
      ethers.utils.hexDataSlice(data, 4),
    );
    const encoded = coder.encode(["address", "address", "uint256", "uint256", "uint64", "uint32"], decodedData);
    const fullEncoded = methodHex + encoded.replace("0x", "");
    const referralData = data.replace(fullEncoded, "");
    if (referralData.length >= 40) {
      const potentialAddress = referralData.slice(referralData.length - 40);
      try {
        const address = ethers.utils.getAddress(`0x${potentialAddress}`);
        return address;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  @OnQueueFailed()
  private onQueueFailed(job: Job, error: Error) {
    this.logger.error(`${ScraperQueue.DepositReferral} ${JSON.stringify(job.data)} failed: ${error}`);
  }
}
