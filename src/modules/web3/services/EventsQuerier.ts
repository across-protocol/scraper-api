import { Logger } from "@nestjs/common";
import { Web3Error, Web3ErrorCode } from "../model/ChainId";
import { Contract, EventFilter, Event } from "ethers";

const DEFAULT_BLOCK_RANGE = 100_000;

export class EventsQuerier {
  constructor(private contract: Contract, private logger: Logger, private blockRangeSize?: number) {}

  public async getEvents(from: number, to: number, filters: EventFilter): Promise<Event[]> {
    let events: Event[] = [];
    let retryWithLowerBatchSize;

    do {
      const blockRangeSizeAtStart = this.blockRangeSize;
      try {
        retryWithLowerBatchSize = false;
        events = [];
        if (this.blockRangeSize) {
          const intervals = this.getSamplesBetween(from, to, this.blockRangeSize);
          // query events only for the first interval to make sure block range is fine
          const [intervalStart, intervalEnd] = intervals[0];
          const newEvents = await this.contract.queryFilter(filters, intervalStart, intervalEnd);
          events.push(...newEvents);

          // query the rest of block intervals in parallel in order to get the events
          const newEventsList = await Promise.all(
            intervals
              .slice(1)
              .map(([intervalStart, intervalEnd]) => this.contract.queryFilter(filters, intervalStart, intervalEnd)),
          );
          events.push(...newEventsList.flat());
        } else {
          const newEvents = await this.contract.queryFilter(filters, from, to);
          events.push(...newEvents);
        }
      } catch (error) {
        let parsedError: any = {};

        try {
          if (error?.body) {
            parsedError = JSON.parse(error?.body);
          }
        } catch {
          parsedError = {};
        }

        if (this.isRequestTooLargeError(error) || this.isRequestTooLargeError(parsedError)) {
          // make sure the block range size wasn't modified by a parallel function call
          if (this.blockRangeSize === blockRangeSizeAtStart) {
            const newBlockRangeSize = this.blockRangeSize ? Math.trunc(this.blockRangeSize / 2) : DEFAULT_BLOCK_RANGE;
            this.logger.warn(`lowering block range size from ${this.blockRangeSize} to ${newBlockRangeSize}`);
            this.blockRangeSize = newBlockRangeSize;
          }
          retryWithLowerBatchSize = true;
        } else {
          retryWithLowerBatchSize = false;
          console.error(error);
          throw error;
        }
      }
    } while (retryWithLowerBatchSize);

    return events;
  }

  private isRequestTooLargeError(error: Web3Error) {
    return (
      (error as Web3Error).error?.code === Web3ErrorCode.BLOCK_RANGE_TOO_LARGE ||
      (error as Web3Error).error?.code === Web3ErrorCode.EXCEEDED_MAXIMUM_BLOCK_RANGE ||
      (error as Web3Error).error?.code === Web3ErrorCode.LOG_RESPONSE_SIZE_EXCEEDED ||
      (error as Web3Error).error?.code === Web3ErrorCode.LOG_RESPONSE_SIZE_EXCEEDED_2
    );
  }
  /**
   * Takes two values and returns a list of number intervals
   *
   * @example
   * ```js
   * getSamplesBetween(1, 9, 3) //returns [[1, 3], [4, 7], [8, 9]]
   * ```
   */
  private getSamplesBetween = (min: number, max: number, size: number) => {
    let keepIterate = true;
    const intervals = [];

    while (keepIterate) {
      const to = Math.min(min + size - 1, max);
      intervals.push([min, to]);
      min = to + 1;
      if (min >= max) keepIterate = false;
    }

    return intervals;
  };
}
