import { MerkleDistributor } from "@across-protocol/contracts-v2";
import { TypedEvent } from "@across-protocol/contracts-v2/dist/typechain/common";
import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";

export class MerkleDistributorEventsQuerier extends EventsQuerier {
  constructor(private merkleDistributor: MerkleDistributor, blockRangeSize?: number) {
    super(merkleDistributor, new Logger(MerkleDistributorEventsQuerier.name), blockRangeSize);
  }

  public async getClaimedEvents(from: number, to: number, account?: string): Promise<TypedEvent<any>[]> {
    return this.getEvents(from, to, this.getClaimedEventsFilter(account));
  }

  private getClaimedEventsFilter(account?: string) {
    if (account) {
      return this.merkleDistributor.filters.Claimed(undefined, undefined, account, undefined, undefined, undefined);
    }
    return this.merkleDistributor.filters.Claimed();
  }
}
