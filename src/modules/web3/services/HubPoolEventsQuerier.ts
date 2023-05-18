import { HubPool } from "@across-protocol/contracts-v2";
import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";
import { clients } from "@across-protocol/sdk-v2";
import { ProposedRootBundle } from "@across-protocol/sdk-v2/dist/interfaces";

/**
 * A class used to reason about on-chain events related to the Across HubPool
 */
export class HubPoolEventsQuerier extends EventsQuerier {
  private hubPoolClient: clients.HubPoolClient;
  constructor(
    private hubPool: HubPool,
    private chainId: number,
    private deploymentBlock: number,
    blockRangeSize?: number,
  ) {
    super(hubPool, new Logger(HubPoolEventsQuerier.name), blockRangeSize);
    this.setHubPoolClient();
  }

  private setHubPoolClient() {
    this.hubPoolClient = new clients.HubPoolClient(undefined, this.hubPool, this.deploymentBlock, this.chainId);
  }

  /**
   * Returns the current HubPool client
   * @returns {clients.HubPoolClient}
   */
  public getHubPoolClient(): clients.HubPoolClient {
    return this.hubPoolClient;
  }

  public async getValidatedProposalEvents(fromBlock: number, toBlock: number): Promise<ProposedRootBundle[]> {
    const latestBlock = await this.hubPool.provider.getBlockNumber();
    const results: ProposedRootBundle[] = [];
    let currentBlock = fromBlock;
    while (currentBlock <= toBlock) {
      const event = this.hubPoolClient.getEarliestFullyExecutedRootBundle(latestBlock, currentBlock);
      if (event && event.blockNumber <= toBlock) {
        results.push(event);
        currentBlock = event.blockNumber + 1;
      } else {
        break;
      }
    }
    return results;
  }
}
