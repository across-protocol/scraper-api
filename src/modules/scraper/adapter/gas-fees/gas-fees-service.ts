import { Injectable } from "@nestjs/common";
import BigNumber from "bignumber.js";

import { fixedPointAdjustment } from "../..//utils";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { chainIdToInfo } from "../../../../utils";
import { MarketPriceService } from "../../../market-price/services/service";

@Injectable()
export class GasFeesService {
  constructor(private providers: EthProvidersService, private marketPriceService: MarketPriceService) {}

  public async getFillTxNetworkFee(destinationChainId: number, fillTxHash: string) {
    const destinationChainProvider = this.providers.getProvider(destinationChainId);
    const destinationChainInfo = chainIdToInfo[destinationChainId];

    if (!destinationChainProvider || !destinationChainInfo) {
      return {
        fillTxBlockNumber: 0,
        fee: "0",
        feeUsd: "0",
      };
    }

    const fillTxReceipt = await destinationChainProvider.getTransactionReceipt(fillTxHash);
    // Some chains, e.g. Optimism, do not return the effective gas price in the receipt. We need to fetch it separately.
    const gasPrice = fillTxReceipt.effectiveGasPrice || (await destinationChainProvider.getGasPrice());
    const fillTxGasCostsWei = gasPrice.mul(fillTxReceipt.gasUsed).toString();
    const fillTxBlock = await this.providers.getCachedBlock(destinationChainId, fillTxReceipt.blockNumber);
    const nativeTokenPriceUsd = await this.marketPriceService.getCachedHistoricMarketPrice(
      fillTxBlock.date,
      destinationChainInfo.nativeSymbol.toLowerCase(),
    );
    const fee = new BigNumber(fillTxGasCostsWei).dividedBy(fixedPointAdjustment);

    return {
      fillTxBlockNumber: fillTxBlock.blockNumber,
      fee: fee.toFixed(),
      feeUsd: fee.multipliedBy(nativeTokenPriceUsd.usd).toFixed(),
    };
  }
}
