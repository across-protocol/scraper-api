import { HttpService } from "@nestjs/axios";
import { CGHistoricPrice } from "./model";

const symbolIdMap = {
  wbtc: "wrapped-bitcoin",
  usdc: "usd-coin",
  uma: "uma",
  badger: "badger-dao",
  weth: "weth",
  boba: "boba-network",
  dai: "dai",
};

export class CoinGeckoService {
  private baseUrl = "https://api.coingecko.com/api/v3";

  constructor(private httpService: HttpService) {}

  public async getHistoricPrice(date: string, symbol: string): Promise<CGHistoricPrice> {
    const id = symbolIdMap[symbol];

    if (!id) throw new Error("Symbol not supported");
    const response = await this.httpService.axiosRef.get(`${this.baseUrl}/coins/bitcoin/history`, {
      params: {
        date,
        location: false,
      },
    });
    return response.data;
  }
}
