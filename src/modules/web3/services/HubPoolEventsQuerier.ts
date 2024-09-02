import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";
import { Contract, Event } from "ethers";

export class HubPoolEventsQuerier extends EventsQuerier {
  constructor(public hubPool: Contract, blockRangeSize?: number) {
    super(hubPool, new Logger(HubPoolEventsQuerier.name), blockRangeSize);
  }

  public async getSetPoolRebalanceRouteEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getSetPoolRebalanceRouteFilters());
  }

  private getSetPoolRebalanceRouteFilters() {
    return this.hubPool.filters.SetPoolRebalanceRoute();
  }
}
