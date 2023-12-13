import { Injectable } from "@nestjs/common";
import BigNumber from "bignumber.js";

import { fixedPointAdjustment } from "../../utils";
import { EthProvidersService } from "../../../web3/services/EthProvidersService";
import { chainIdToInfo } from "../../../../utils";
import { MarketPriceService } from "../../../market-price/services/service";

@Injectable()
export class GasFeesService {
  constructor(private providers: EthProvidersService, private marketPriceService: MarketPriceService) {}

  public async getFillTxNetworkFee(destinationChainId: number, fillTxHash: string) {
    const destinationChainInfo = chainIdToInfo[destinationChainId];

    if (!destinationChainInfo) {
      throw new Error(`Can not get network fee on unknown chain id: ${destinationChainId}`);
    }

    const fillTxReceipt = await this.providers.getCachedTransactionReceipt(destinationChainId, fillTxHash);
    const fillTxGasCostWei = new BigNumber(fillTxReceipt.effectiveGasPrice).multipliedBy(fillTxReceipt.gasUsed);
    const fillTxBlock = await this.providers.getCachedBlock(destinationChainId, fillTxReceipt.blockNumber);
    const nativeTokenPriceUsd = await this.marketPriceService.getCachedHistoricMarketPrice(
      fillTxBlock.date,
      destinationChainInfo.nativeSymbol.toLowerCase(),
    );
    const fee = fillTxGasCostWei.dividedBy(fixedPointAdjustment);

    if (!nativeTokenPriceUsd) {
      throw new Error(`Can not get network fee without price for native token on chain id: ${destinationChainId}`);
    }

    return {
      fillTxBlockNumber: fillTxBlock.blockNumber,
      fee: fee.toFixed(),
      feeUsd: fee.multipliedBy(nativeTokenPriceUsd.usd).toFixed(),
    };
  }
}
