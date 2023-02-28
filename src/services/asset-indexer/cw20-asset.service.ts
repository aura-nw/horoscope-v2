export interface ICW20MarketingInfo {
  data: {
    project: string;
    description: string;
    logo: {
      url: string;
    };
    marketing: string;
  };
}
export interface ICW20BalanceInfo {
  data: {
    balance: string;
  };
}

export interface ICW20AssetInfo {
  data: {
    name: string;
    symbol: string;
    decimals: number;
    total_supply: string;
  };
}
