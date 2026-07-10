export interface Asset {
  id: string;
  name: string;
  class: string;
  position: number;
  cost: number;
  price: number;
  totalValue: number;
  profit: number;
  profitPercentage: number;
}

export interface PortfolioClass {
  id: string;
  name: string;
  totalValue: number;
  percentage: number;
  assets: Asset[];
}

export const portfolioData: PortfolioClass[] = [
  {
    id: "rv-nacional",
    name: "RV Nacional",
    totalValue: 1133988,
    percentage: 58.8,
    assets: [
      { id: "VALE3", name: "VALE3", class: "RV Nacional", position: 1346, cost: 63.45, price: 87.64, totalValue: 117963.44, profit: 32566.47, profitPercentage: 38.2 },
      { id: "SBSP3", name: "SBSP3", class: "RV Nacional", position: 669, cost: 64.51, price: 173.59, totalValue: 116131.71, profit: 72977.20, profitPercentage: 168.8 },
      { id: "CMIN3", name: "CMIN3", class: "RV Nacional", position: 21717, cost: 4.86, price: 4.98, totalValue: 108150.66, profit: 2584.32, profitPercentage: 2.4 },
      { id: "MBRF3", name: "MBRF3", class: "RV Nacional", position: 4120, cost: 13.30, price: 19.17, totalValue: 78980.40, profit: 24184.40, profitPercentage: 44.2 },
      { id: "CYRE3", name: "CYRE3", class: "RV Nacional", position: 2679, cost: 20.83, price: 27.31, totalValue: 73163.49, profit: 17359.92, profitPercentage: 31.1 },
      { id: "BPAC11", name: "BPAC11", class: "RV Nacional", position: 1122, cost: 34.11, price: 62.16, totalValue: 69743.52, profit: 31468.73, profitPercentage: 82.3 },
      { id: "AXIA6", name: "AXIA6", class: "RV Nacional", position: 967, cost: 41.05, price: 68.97, totalValue: 66693.99, profit: 26997.67, profitPercentage: 68.0 },
      { id: "ORVR3", name: "ORVR3", class: "RV Nacional", position: 677, cost: 31.66, price: 82.20, totalValue: 55649.40, profit: 34215.58, profitPercentage: 159.7 },
      { id: "BBAS3", name: "BBAS3", class: "RV Nacional", position: 2130, cost: 20.41, price: 23.46, totalValue: 49969.80, profit: 6505.02, profitPercentage: 15.0 },
      { id: "BRAV3", name: "BRAV3", class: "RV Nacional", position: 2241, cost: 29.85, price: 20.37, totalValue: 45649.17, profit: -21237.96, profitPercentage: -31.8 },
      { id: "TTEN3", name: "TTEN3", class: "RV Nacional", position: 2615, cost: 11.17, price: 15.96, totalValue: 41735.40, profit: 12528.47, profitPercentage: 42.9 },
      { id: "INBR32", name: "INBR32", class: "RV Nacional", position: 1037, cost: 36.02, price: 40.17, totalValue: 41656.29, profit: 4304.59, profitPercentage: 11.5 },
      { id: "KEPL3", name: "KEPL3", class: "RV Nacional", position: 4612, cost: 8.31, price: 8.11, totalValue: 37403.32, profit: -922.40, profitPercentage: -2.4 },
      { id: "SUZB3", name: "SUZB3", class: "RV Nacional", position: 758, cost: 58.84, price: 47.71, totalValue: 36164.18, profit: -8434.27, profitPercentage: -18.9 },
      { id: "CXSE3", name: "CXSE3", class: "RV Nacional", position: 1733, cost: 12.12, price: 18.79, totalValue: 32563.07, profit: 11553.91, profitPercentage: 54.9 },
      { id: "BBDC4", name: "BBDC4", class: "RV Nacional", position: 1042, cost: 14.83, price: 20.50, totalValue: 21361.00, profit: 5908.14, profitPercentage: 38.2 },
      { id: "CYRE4", name: "CYRE4", class: "RV Nacional", position: 507, cost: 26.00, price: 29.15, totalValue: 14779.05, profit: 1597.05, profitPercentage: 12.1 },
      { id: "AGRO3", name: "AGRO3", class: "RV Nacional", position: 735, cost: 23.94, price: 19.95, totalValue: 14663.25, profit: -2932.65, profitPercentage: -16.7 },
      { id: "AXIA7", name: "AXIA7", class: "RV Nacional", position: 246, cost: 30.10, price: 59.04, totalValue: 14523.84, profit: 7119.24, profitPercentage: 96.1 },
      { id: "XPML11", name: "XPML11", class: "RV Nacional", position: 114, cost: 101.57, price: 110.31, totalValue: 12575.34, profit: 996.70, profitPercentage: 8.6 },
      { id: "SOJA3", name: "SOJA3", class: "RV Nacional", position: 1503, cost: 11.74, price: 7.17, totalValue: 10776.51, profit: -6868.71, profitPercentage: -38.9 },
      { id: "FLRY3", name: "FLRY3", class: "RV Nacional", position: 626, cost: 17.40, price: 16.53, totalValue: 10347.78, profit: -545.25, profitPercentage: -5.0 },
      { id: "KLBN11", name: "KLBN11", class: "RV Nacional", position: 432, cost: 18.79, price: 18.77, totalValue: 8108.64, profit: -8.64, profitPercentage: -0.1 },
      { id: "AURE3", name: "AURE3", class: "RV Nacional", position: 353, cost: 11.74, price: 14.25, totalValue: 5030.25, profit: 886.03, profitPercentage: 21.4 }
    ]
  },
  {
    id: "fundos",
    name: "Fundos",
    totalValue: 340042,
    percentage: 17.6,
    assets: [
      { id: "KINEA_GAMA", name: "KINEA GAMA FIFI CI", class: "Fundos", position: 1, cost: 105666.39, price: 103553.74, totalValue: 103553.74, profit: -2112.65, profitPercentage: -2.0 },
      { id: "AZ_QUEST", name: "AZ Quest Valore FIR", class: "Fundos", position: 1, cost: 54605.13, price: 55402.73, totalValue: 55402.73, profit: 797.60, profitPercentage: 1.5 },
      { id: "BNP_RUBI", name: "BNP PARIBAS RUBI", class: "Fundos", position: 1, cost: 52589.76, price: 53380.86, totalValue: 53380.86, profit: 791.10, profitPercentage: 1.5 },
      { id: "XP_ELET3", name: "XP FMP ELET3", class: "Fundos", position: 1, cost: 24477.28, price: 46582.55, totalValue: 46582.55, profit: 22105.27, profitPercentage: 90.3 },
      { id: "FGTS", name: "FGTS", class: "Fundos", position: 1, cost: 0, price: 38717.65, totalValue: 38717.65, profit: 38717.65, profitPercentage: 100 },
      { id: "TC_COSMOS", name: "TC COSMOS - GENIA", class: "Fundos", position: 1, cost: 19796.10, price: 35652.15, totalValue: 35652.15, profit: 15856.05, profitPercentage: 80.1 },
      { id: "SISPRIME", name: "SISPRIME", class: "Fundos", position: 1, cost: 4550.00, price: 6689.16, totalValue: 6689.16, profit: 2139.16, profitPercentage: 47.0 },
      { id: "TREND_INV", name: "TREND INVESTBACK", class: "Fundos", position: 1, cost: 59.98, price: 63.42, totalValue: 63.42, profit: 3.44, profitPercentage: 5.7 }
    ]
  },
  {
    id: "rv-eua",
    name: "RV EUA",
    totalValue: 213467,
    percentage: 11.1,
    assets: [
      { id: "TSM", name: "TSM", class: "RV EUA", position: 16.62, cost: 141.96, price: 379.45, totalValue: 31320.32, profit: 19602.41, profitPercentage: 167.3 },
      { id: "MU", name: "MU", class: "RV EUA", position: 12.77, cost: 89.79, price: 478.03, totalValue: 30319.60, profit: 24624.56, profitPercentage: 432.4 },
      { id: "GOOGL", name: "GOOGL", class: "RV EUA", position: 17.63, cost: 204.51, price: 335.65, totalValue: 29393.33, profit: 11484.20, profitPercentage: 64.1 },
      { id: "TSLA", name: "TSLA", class: "RV EUA", position: 10.57, cost: 194.77, price: 390.66, totalValue: 20501.33, profit: 10280.16, profitPercentage: 100.6 },
      { id: "MSFT", name: "MSFT", class: "RV EUA", position: 8.63, cost: 416.92, price: 431.94, totalValue: 18513.35, profit: 643.71, profitPercentage: 3.6 },
      { id: "CVX", name: "CVX", class: "RV EUA", position: 16.29, cost: 161.62, price: 187.24, totalValue: 15143.48, profit: 2072.17, profitPercentage: 15.9 },
      { id: "NVIDIA", name: "NVIDIA", class: "RV EUA", position: 11.21, cost: 185.13, price: 201.20, totalValue: 11200.35, profit: 894.10, profitPercentage: 8.7 },
      { id: "NET", name: "NET", class: "RV EUA", position: 10.22, cost: 76.36, price: 206.72, totalValue: 10495.30, profit: 6618.56, profitPercentage: 170.7 },
      { id: "CRWD", name: "CRWD", class: "RV EUA", position: 4.00, cost: 307.44, price: 461.87, totalValue: 9174.77, profit: 3067.60, profitPercentage: 50.2 },
      { id: "BAC", name: "BAC", class: "RV EUA", position: 33.97, cost: 31.76, price: 53.19, totalValue: 8974.03, profit: 3615.42, profitPercentage: 67.5 },
      { id: "AMZN", name: "AMZN", class: "RV EUA", position: 4.88, cost: 122.44, price: 252.61, totalValue: 6124.18, profit: 3155.86, profitPercentage: 106.3 },
      { id: "BANC", name: "BANC", class: "RV EUA", position: 59.64, cost: 14.52, price: 18.40, totalValue: 5449.44, profit: 1150.01, profitPercentage: 26.8 },
      { id: "PGEN", name: "PGEN", class: "RV EUA", position: 206.41, cost: 1.99, price: 3.96, totalValue: 4054.01, profit: 2012.14, profitPercentage: 98.5 },
      { id: "UNH", name: "UNH", class: "RV EUA", position: 1.72, cost: 318.12, price: 356.02, totalValue: 3041.45, profit: 323.76, profitPercentage: 11.9 },
      { id: "TWST", name: "TWST", class: "RV EUA", position: 9.14, cost: 29.16, price: 64.08, totalValue: 2909.87, profit: 1585.84, profitPercentage: 119.8 },
      { id: "AAPL", name: "AAPL", class: "RV EUA", position: 2.08, cost: 212.43, price: 273.03, totalValue: 2822.94, profit: 626.60, profitPercentage: 28.5 },
      { id: "CRWV", name: "CRWV", class: "RV EUA", position: 3.08, cost: 119.55, price: 123.55, totalValue: 1888.49, profit: 61.22, profitPercentage: 3.4 },
      { id: "ABBV", name: "ABBV", class: "RV EUA", position: 0.85, cost: 203.48, price: 202.92, totalValue: 856.47, profit: -2.36, profitPercentage: -0.3 },
      { id: "NEE", name: "NEE", class: "RV EUA", position: 1.56, cost: 70.41, price: 91.17, totalValue: 707.34, profit: 161.04, profitPercentage: 29.5 },
      { id: "ENPH", name: "ENPH", class: "RV EUA", position: 1.90, cost: 42.46, price: 35.22, totalValue: 332.43, profit: -68.34, profitPercentage: -17.1 },
      { id: "SOUN", name: "SOUN", class: "RV EUA", position: 6.14, cost: 9.45, price: 8.04, totalValue: 244.96, profit: -43.14, profitPercentage: -15.0 }
    ]
  },
  {
    id: "cripto",
    name: "Criptomoedas",
    totalValue: 91223,
    percentage: 4.7,
    assets: [
      { id: "BTC", name: "BTC - BITCOIN", class: "Criptomoedas", position: 0.098712, cost: 65320.53, price: 68144.80, totalValue: 33405.65, profit: 1384.50, profitPercentage: 4.3 },
      { id: "ETH", name: "ETHEREUM", class: "Criptomoedas", position: 2.626230, cost: 3053.22, price: 2098.33, totalValue: 27366.67, profit: -12453.76, profitPercentage: -31.3 },
      { id: "SOL", name: "SOL", class: "Criptomoedas", position: 32.063260, cost: 133.00, price: 82.69, totalValue: 13166.68, profit: -8011.47, profitPercentage: -37.8 },
      { id: "BNB", name: "BNB", class: "Criptomoedas", position: 1.56109, cost: 3602.00, price: 3198.00, totalValue: 4992.37, profit: -630.68, profitPercentage: -11.2 },
      { id: "BTC_BIN", name: "BTC - BINANCE", class: "Criptomoedas", position: 0.014070, cost: 0, price: 68144.80, totalValue: 4761.48, profit: 197.34, profitPercentage: 4.3 },
      { id: "ETH_BIN", name: "ETH - BINANCE", class: "Criptomoedas", position: 0.309500, cost: 0, price: 2098.33, totalValue: 3225.15, profit: 1467.67, profitPercentage: 83.5 },
      { id: "SOL_BIN", name: "SOL - BINANCE", class: "Criptomoedas", position: 7.107724, cost: 0, price: 82.69, totalValue: 2918.76, profit: 1775.00, profitPercentage: 155.2 },
      { id: "AVAX", name: "AVAX", class: "Criptomoedas", position: 31.39455, cost: 38.65, price: 8.89, totalValue: 1386.03, profit: -4640.30, profitPercentage: -77.0 }
    ]
  },
  {
    id: "renda-fixa",
    name: "Renda Fixa",
    totalValue: 50068,
    percentage: 2.6,
    assets: [
      { id: "15_55", name: "15,55%", class: "Renda Fixa", position: 1, cost: 5000.00, price: 5918.36, totalValue: 5918.36, profit: 918.36, profitPercentage: 18.4 },
      { id: "IPCA_6_55", name: "IPCA+6,55%", class: "Renda Fixa", position: 1, cost: 5000.00, price: 5848.39, totalValue: 5848.39, profit: 848.39, profitPercentage: 17.0 },
      { id: "IPCA_7_95", name: "IPCA+7,95%", class: "Renda Fixa", position: 1, cost: 5000.00, price: 5682.97, totalValue: 5682.97, profit: 682.97, profitPercentage: 13.7 },
      { id: "IPCA_8_25_2", name: "IPCA+8,25%", class: "Renda Fixa", position: 1, cost: 3999.95, price: 5008.39, totalValue: 5008.39, profit: 1008.44, profitPercentage: 25.2 },
      { id: "IPCA_6_85", name: "IPCA+6,85", class: "Renda Fixa", position: 1, cost: 4000.00, price: 4757.97, totalValue: 4757.97, profit: 757.97, profitPercentage: 18.9 },
      { id: "IPCA_7_01", name: "IPCA+7,01%", class: "Renda Fixa", position: 1, cost: 4234.47, price: 4567.47, totalValue: 4567.47, profit: 333.00, profitPercentage: 7.9 },
      { id: "IPCA_7_4", name: "IPCA+7,4%", class: "Renda Fixa", position: 1, cost: 7818.69, price: 3418.08, totalValue: 3418.08, profit: -4400.61, profitPercentage: -56.3 },
      { id: "SELIC_31", name: "TESOURO SELIC 31", class: "Renda Fixa", position: 1, cost: 3208.66, price: 3350.30, totalValue: 3350.30, profit: 141.64, profitPercentage: 4.4 },
      { id: "PRE_15", name: "PRÉ 15%", class: "Renda Fixa", position: 1, cost: 2949.31, price: 3271.62, totalValue: 3271.62, profit: 322.31, profitPercentage: 10.9 },
      { id: "PRE_15_05", name: "PRÉ 15,05% AA", class: "Renda Fixa", position: 1, cost: 1058.98, price: 1534.77, totalValue: 1534.77, profit: 475.79, profitPercentage: 44.9 },
      { id: "PRE_14_90", name: "PRÉ 14,90% AA", class: "Renda Fixa", position: 1, cost: 1146.71, price: 1529.83, totalValue: 1529.83, profit: 383.12, profitPercentage: 33.4 },
      { id: "PRE_15_31", name: "PRÉ 15,31% AA", class: "Renda Fixa", position: 1, cost: 930.94, price: 1426.52, totalValue: 1426.52, profit: 495.58, profitPercentage: 53.2 },
      { id: "IPCA_8_8", name: "IPCA+8,8%", class: "Renda Fixa", position: 1, cost: 974.77, price: 1204.77, totalValue: 1204.77, profit: 230.00, profitPercentage: 23.6 },
      { id: "IPCA_8_25_1", name: "IPCA+8,25%", class: "Renda Fixa", position: 1, cost: 877.49, price: 1108.12, totalValue: 1108.12, profit: 230.63, profitPercentage: 26.3 },
      { id: "CDI_ISENTO", name: "99,5% CDI ISENTO", class: "Renda Fixa", position: 1, cost: 1054.30, price: 1051.98, totalValue: 1051.98, profit: -2.32, profitPercentage: -0.2 },
      { id: "IPCA_8_3", name: "IPCA+8,3%", class: "Renda Fixa", position: 1, cost: 499.69, price: 338.03, totalValue: 338.03, profit: -161.66, profitPercentage: -32.4 }
    ]
  },
  {
    id: "uranio",
    name: "Urânio",
    totalValue: 39719,
    percentage: 2.1,
    assets: [
      { id: "URNM", name: "URNM", class: "Urânio", position: 112.20, cost: 58.95, price: 68.71, totalValue: 38284.09, profit: 5438.67, profitPercentage: 16.6 },
      { id: "URA", name: "URA", class: "Urânio", position: 4.44, cost: 52.45, price: 55.59, totalValue: 1434.70, profit: 80.99, profitPercentage: 6.0 }
    ]
  },
  {
    id: "india",
    name: "Índia",
    totalValue: 3751,
    percentage: 0.2,
    assets: [
      { id: "INDA", name: "INDA ETF", class: "Índia", position: 9.83, cost: 53.53, price: 50.08, totalValue: 2443.85, profit: -168.11, profitPercentage: -6.4 },
      { id: "INFY", name: "INFY ADR", class: "Índia", position: 11.54, cost: 17.64, price: 13.63, totalValue: 780.54, profit: -229.90, profitPercentage: -22.8 },
      { id: "HDB", name: "HDB ADR", class: "Índia", position: 2.93, cost: 35.48, price: 26.09, totalValue: 379.92, profit: -136.78, profitPercentage: -26.5 },
      { id: "IBN", name: "IBN ADR", class: "Índia", position: 1.04, cost: 31.73, price: 28.48, totalValue: 147.09, profit: -16.81, profitPercentage: -10.3 }
    ]
  },
  {
    id: "caixa",
    name: "Caixa + Dividendos",
    totalValue: 41926,
    percentage: 2.2,
    assets: [
      { id: "CAIXA", name: "Caixa Disponível", class: "Caixa", position: 1, cost: 36533.64, price: 36533.64, totalValue: 36533.64, profit: 0, profitPercentage: 0 },
      { id: "DIVIDENDOS", name: "Dividendos a Receber", class: "Caixa", position: 1, cost: 5392.27, price: 5392.27, totalValue: 5392.27, profit: 0, profitPercentage: 0 }
    ]
  }
];

export const summaryData = {
  totalPatrimony: 1914184,
  totalProfit: 284560, // Estimativa baseada nos lucros reportados
  profitPercentage: 17.4,
  lastUpdate: "22/04/2026"
};
