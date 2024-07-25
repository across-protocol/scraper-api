import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { CGHistoricPrice } from "./model";

export const symbolIdMap = {
  eth: "ethereum",
  matic: "matic-network",
  wbtc: "wrapped-bitcoin",
  usdc: "usd-coin",
  uma: "uma",
  badger: "badger-dao",
  weth: "weth",
  boba: "boba-network",
  dai: "dai",
  bal: "balancer",
  usdt: "tether",
  acx: "across-protocol",
  snx: "havven",
  pool: "pooltogether",
  usdbc: "bridged-usd-coin-base",
  op: "optimism",
  "usdc.e": "usd-coin-ethereum-bridged",
  arb: "arbitrum",
  usdb: "usdb",
  lsk: "lisk",
};

@Injectable()
export class CoinGeckoService {
  private baseUrl = "https://api.coingecko.com/api/v3";

  constructor(private httpService: HttpService) {}

  public async getHistoricPrice(date: string, symbol: string): Promise<CGHistoricPrice> {
    const id = symbolIdMap[symbol];

    if (!id) throw new Error("Symbol not supported");
    const response = await this.httpService.axiosRef.get(`${this.baseUrl}/coins/${id}/history`, {
      params: {
        date,
        location: false,
      },
    });
    return response.data;
  }
}
