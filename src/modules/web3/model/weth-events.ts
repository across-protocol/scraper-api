import { BigNumber, Event } from "ethers";

export interface WethDepositEvent extends Event {
  args: [string, BigNumber] & {
    dst: string;
    wad: BigNumber;
  };
}

export interface WethDepositEventOptimism extends Event {
  args: [string, BigNumber] & {
    dst: string;
    wad: BigNumber;
  };
}

export interface WethDepositEventLinea extends Event {
  args: [string, BigNumber] & {
    dst: string;
    wad: BigNumber;
  };
}

export interface WethDepositEventBase extends Event {
  args: [string, BigNumber] & {
    dst: string;
    wad: BigNumber;
  };
}

export interface WethTransferEventArbitrum extends Event {
  args: [string, string, BigNumber] & {
    from: string;
    to: string;
    value: BigNumber;
  };
}
