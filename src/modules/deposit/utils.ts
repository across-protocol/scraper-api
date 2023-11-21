import { DateTime } from "luxon";

import { Deposit } from "./model/deposit.entity";

/**
 * Format deposit to entity to match `Transfer` structure from sdk.
 * @param deposit - Deposit entity from db.
 * @returns Formatted deposit entity that matches `Transfer` struct.
 */
export function formatDeposit(deposit: Deposit) {
  return {
    depositId: deposit.depositId,
    depositTime: Math.round(DateTime.fromISO(deposit.depositDate.toISOString()).toSeconds()),
    fillTime: deposit.filledDate
      ? Math.round(DateTime.fromISO(deposit.filledDate.toISOString()).toSeconds())
      : undefined,
    status: deposit.status,
    filled: deposit.filled,
    sourceChainId: deposit.sourceChainId,
    destinationChainId: deposit.destinationChainId,
    assetAddr: deposit.tokenAddr,
    assetSymbol: deposit.token?.symbol,
    depositorAddr: deposit.depositorAddr,
    recipientAddr: deposit.recipientAddr,
    message: deposit.message,
    amount: deposit.amount,
    depositTxHash: deposit.depositTxHash,
    fillTxs: deposit.fillTxs.map(({ hash }) => hash),
    speedUps: deposit.speedUps,
    depositRelayerFeePct: deposit.depositRelayerFeePct,
    initialRelayerFeePct: deposit.initialRelayerFeePct,
    suggestedRelayerFeePct: deposit.suggestedRelayerFeePct,
    feeBreakdown: deposit.feeBreakdown,
  };
}
