import { BigNumber, Event } from "ethers";

export interface SetPoolRebalanceRoute extends Event {
  args: [
    BigNumber,
    string,
    string,
  ] & {
    destinationChainId: BigNumber;
    l1Token: string;
    destinationToken: string;
  }
}
