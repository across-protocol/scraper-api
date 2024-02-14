import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";
import { Contract, Event } from "ethers";

export class SpokePoolEventsQuerier extends EventsQuerier {
  constructor(private spokePool: Contract, blockRangeSize?: number) {
    super(spokePool, new Logger(SpokePoolEventsQuerier.name), blockRangeSize);
  }

  public async getFundsDepositEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getFundsDepositedEventFilters());
  }

  public async getFundsDepositedV3Events(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getFundsDepositedV3EventFilters());
  }

  public async getFilledRelayEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getFilledRelayEventsFilter());
  }

  public async getFilledV3RelayEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getFilledV3RelayEventsFilter());
  }

  public async getRequestedSpeedUpDepositEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getRequestedSpeedUpDepositEventsFilters());
  }

  private getFilledRelayEventsFilter() {
    return this.spokePool.filters.FilledRelay();
  }

  private getFilledV3RelayEventsFilter() {
    return this.spokePool.filters.FilledV3Relay();
  }

  private getFundsDepositedEventFilters() {
    return this.spokePool.filters.FundsDeposited();
  }

  private getFundsDepositedV3EventFilters() {
    return this.spokePool.filters.V3FundsDeposited();
  }

  private getRequestedSpeedUpDepositEventsFilters() {
    return this.spokePool.filters.RequestedSpeedUpDeposit();
  }
}
