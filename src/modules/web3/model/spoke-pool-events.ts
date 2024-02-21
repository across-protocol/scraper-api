import { BigNumber, Event } from "ethers";

export interface FundsDepositedEvent2 extends Event {
  args: [BigNumber, BigNumber, BigNumber, BigNumber, number, number, string, string, string] & {
    amount: BigNumber;
    originChainId: BigNumber;
    destinationChainId: BigNumber;
    relayerFeePct: BigNumber;
    depositId: number;
    quoteTimestamp: number;
    originToken: string;
    recipient: string;
    depositor: string;
  };
}

export interface FundsDepositedEvent2_5 extends Event {
  args: [BigNumber, BigNumber, BigNumber, BigNumber, number, number, string, string, string, string] & {
    amount: BigNumber;
    originChainId: BigNumber;
    destinationChainId: BigNumber;
    relayerFeePct: BigNumber;
    depositId: number;
    quoteTimestamp: number;
    originToken: string;
    recipient: string;
    depositor: string;
    message: string;
  };
}

export interface FundsDepositedV3Event extends Event {
  args: [
    string,
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    number,
    number,
    number,
    number,
    string,
    string,
    string,
    string,
  ] & {
    destinationChainId: BigNumber;
    depositId: number;
    quoteTimestamp: number;
    recipient: string;
    depositor: string;
    message: string;
    // New properties in V3
    inputToken: string;
    outputToken: string;
    inputAmount: BigNumber;
    outputAmount: BigNumber;
    fillDeadline: number;
    exclusivityDeadline: number;
    relayer: string;
    // Missing events from V2
    // relayerFeePct: BigNumber;
    // originToken: string;
  };
}

export interface FilledRelayEvent2 extends Event {
  args: [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    number,
    string,
    string,
    string,
    string,
    boolean,
  ] & {
    amount: BigNumber;
    totalFilledAmount: BigNumber;
    fillAmount: BigNumber;
    repaymentChainId: BigNumber;
    originChainId: BigNumber;
    destinationChainId: BigNumber;
    relayerFeePct: BigNumber;
    appliedRelayerFeePct: BigNumber;
    realizedLpFeePct: BigNumber;
    depositId: number;
    destinationToken: string;
    relayer: string;
    depositor: string;
    recipient: string;
    isSlowRelay: boolean;
  };
}

export interface FilledRelayEvent2_5 extends Event {
  args: [
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    number,
    string,
    string,
    string,
    string,
    string,
    [string, string, BigNumber, boolean, BigNumber] & {
      recipient: string;
      message: string;
      relayerFeePct: BigNumber;
      isSlowRelay: boolean;
      payoutAdjustmentPct: BigNumber;
    },
  ] & {
    amount: BigNumber;
    totalFilledAmount: BigNumber;
    fillAmount: BigNumber;
    repaymentChainId: BigNumber;
    originChainId: BigNumber;
    destinationChainId: BigNumber;
    relayerFeePct: BigNumber;
    realizedLpFeePct: BigNumber;
    depositId: number;
    destinationToken: string;
    relayer: string;
    depositor: string;
    recipient: string;
    message: string;
    updatableRelayData: [string, string, BigNumber, boolean, BigNumber] & {
      recipient: string;
      message: string;
      relayerFeePct: BigNumber;
      isSlowRelay: boolean;
      payoutAdjustmentPct: BigNumber;
    };
  };
}

export interface FilledV3RelayEvent extends Event {
  args: [
    string,
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    number,
    number,
    number,
    string,
    string,
    string,
    string,
    string,
    [string, string, BigNumber, number] & {
      updatedRecipient: string;
      updatedMessage: string;
      updatedOutputAmount: BigNumber;
      fillType: number;
    },
  ] & {
    inputToken: string;
    outputToken: string;
    inputAmount: BigNumber;
    outputAmount: BigNumber;
    repaymentChainId: BigNumber;
    originChainId: BigNumber;
    depositId: number;
    fillDeadline: number;
    exclusivityDeadline: number;
    exclusiveRelayer: string;
    relayer: string;
    depositor: string;
    recipient: string;
    message: string;
    relayExecutionInfo: [string, string, BigNumber, number] & {
      updatedRecipient: string;
      updatedMessage: string;
      updatedOutputAmount: BigNumber;
      fillType: number;
    };
  };
}

export interface RequestedSpeedUpDepositEvent2 extends Event {
  args: [BigNumber, number, string, string] & {
    newRelayerFeePct: BigNumber;
    depositId: number;
    depositor: string;
    depositorSignature: string;
  };
}

export interface RequestedSpeedUpDepositEvent2_5 extends Event {
  args: [BigNumber, number, string, string, string, string] & {
    newRelayerFeePct: BigNumber;
    depositId: number;
    depositor: string;
    updatedRecipient: string;
    updatedMessage: string;
    depositorSignature: string;
  };
}

export interface RequestedSpeedUpV3DepositEvent extends Event {
  args: [BigNumber, number, string, string, string, string] & {
    updatedOutputAmount: BigNumber;
    depositId: number;
    depositor: string;
    updatedRecipient: string;
    updatedMessage: string;
    depositorSignature: string;
  };
}
