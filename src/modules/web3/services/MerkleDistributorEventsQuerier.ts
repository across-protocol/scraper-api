import { AcrossMerkleDistributor } from "@across-protocol/contracts-v2";
import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";
import { Event } from "ethers";

export class MerkleDistributorEventsQuerier extends EventsQuerier {
  constructor(private merkleDistributor: AcrossMerkleDistributor, blockRangeSize?: number) {
    super(merkleDistributor, new Logger(MerkleDistributorEventsQuerier.name), blockRangeSize);
  }

  public async getClaimedEvents(from: number, to: number, account?: string): Promise<Event[]> {
    return this.getEvents(from, to, this.getClaimedEventsFilter(account));
  }

  private getClaimedEventsFilter(account?: string) {
    if (account) {
      return this.merkleDistributor.filters.Claimed(undefined, undefined, account, undefined, undefined, undefined);
    }
    return this.merkleDistributor.filters.Claimed();
  }
}
