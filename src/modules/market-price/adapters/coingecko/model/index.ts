export type CGHistoricPrice = {
  id: string;
  symbol: string;
  name: string;
  market_data?: {
    current_price: {
      usd: number;
    };
  };
};
