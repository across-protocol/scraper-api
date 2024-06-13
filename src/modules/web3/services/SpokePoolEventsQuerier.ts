import { Logger } from "@nestjs/common";
import { EventsQuerier } from "./EventsQuerier";
import { Contract, Event } from "ethers";

export class SpokePoolEventsQuerier extends EventsQuerier {
  constructor(public spokePool: Contract, blockRangeSize?: number) {
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

  public async getFilledV3RelayEvent(
    from: number,
    to: number,
    originChainId: number,
    depositId: number,
  ): Promise<Event> {
    const events = await this.getEvents(from, to, this.getFilledV3RelayEventFilter(originChainId, depositId));
    return events[0];
  }

  public async getRequestedSpeedUpDepositEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getRequestedSpeedUpDepositEventsFilters());
  }

  public async getRequestedSpeedUpV3DepositEvents(from: number, to: number): Promise<Event[]> {
    return this.getEvents(from, to, this.getRequestedSpeedUpV3DepositEventsFilters());
  }

  private getFilledRelayEventsFilter() {
    return this.spokePool.filters.FilledRelay();
  }

  private getFilledV3RelayEventsFilter() {
    return this.spokePool.filters.FilledV3Relay();
  }

  private getFilledV3RelayEventFilter(originChainId: number, depositId: number) {
    return this.spokePool.filters.FilledV3Relay(
      null,
      null,
      null,
      null,
      null,
      originChainId,
      depositId,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );
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

  private getRequestedSpeedUpV3DepositEventsFilters() {
    return this.spokePool.filters.RequestedSpeedUpV3Deposit();
  }
}
