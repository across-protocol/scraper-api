import { SpokePool } from "@across-protocol/contracts-v2";
import { TypedEvent } from "@across-protocol/contracts-v2/dist/typechain/common";
import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";

export class SpokePoolEventsQuerier extends EventsQuerier {
  constructor(private spokePool: SpokePool, blockRangeSize?: number) {
    super(spokePool, new Logger(SpokePoolEventsQuerier.name), blockRangeSize);
  }

  public async getFundsDepositEvents(from: number, to: number, depositorAddr?: string): Promise<TypedEvent<any>[]> {
    return this.getEvents(from, to, this.getDepositEventsFilters(depositorAddr));
  }

  public async getFilledRelayEvents(from: number, to: number, depositorAddr?: string): Promise<TypedEvent<any>[]> {
    return this.getEvents(from, to, this.getFilledRelayEventsFilter(depositorAddr));
  }

  private getFilledRelayEventsFilter(depositorAddr?: string) {
    if (depositorAddr) {
      return this.spokePool.filters.FilledRelay(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        depositorAddr,
        undefined,
        undefined,
      );
    }
    return this.spokePool.filters.FilledRelay();
  }

  private getDepositEventsFilters(depositorAddr?: string) {
    if (depositorAddr) {
      return this.spokePool.filters.FundsDeposited(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        depositorAddr.toLowerCase(),
      );
    }
    return this.spokePool.filters.FundsDeposited();
  }
}
