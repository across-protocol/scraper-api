import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";
import { Contract, Event } from "ethers";

export class SpokePoolEventsQuerier extends EventsQuerier {
  constructor(private spokePool: Contract, blockRangeSize?: number) {
    super(spokePool, new Logger(SpokePoolEventsQuerier.name), blockRangeSize);
  }

  public async getFundsDepositEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getDepositEventsFilters());
  }

  public async getFilledRelayEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getFilledRelayEventsFilter());
  }

  public async getRequestedSpeedUpDepositEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getRequestedSpeedUpDepositEventsFilters());
  }

  public async getRefundRequestedEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getRefundRequestedEventsFilters());
  }

  private getFilledRelayEventsFilter() {
    return this.spokePool.filters.FilledRelay();
  }

  private getDepositEventsFilters() {
    return this.spokePool.filters.FundsDeposited();
  }

  private getRequestedSpeedUpDepositEventsFilters() {
    return this.spokePool.filters.RequestedSpeedUpDeposit();
  }

  private getRefundRequestedEventsFilters() {
    return this.spokePool.filters.RefundRequested();
  }
}
