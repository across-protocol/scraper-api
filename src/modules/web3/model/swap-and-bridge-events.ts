import { BigNumber, Event } from "ethers";

export interface SwapBeforeBridgeEvent extends Event {
  args: [string, string, string, BigNumber, BigNumber, string, BigNumber] & {
    exchange: string;
    swapToken: string;
    acrossInputToken: string;
    swapTokenAmount: BigNumber;
    acrossInputAmount: BigNumber;
    acrossOutputToken: string;
    acrossOutputAmount: BigNumber;
  };
}
