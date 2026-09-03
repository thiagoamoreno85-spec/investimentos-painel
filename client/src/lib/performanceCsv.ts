export type CsvPerformanceAsset = {
  ticker: string;
  name: string;
  classLabel: string;
  currency: string;
  marketPnlBRL: number;
  incomePnlBRL: number;
  changeBRL: number;
  changePct: number;
  startValueBRL: number;
  valueBRL: number;
};

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function buildPerformanceCsv(
  date: string,
  source: string,
  assets: CsvPerformanceAsset[]
) {
  const rows = [
    ["Data", "Origem", "Ativo", "Nome", "Classe", "Moeda", "Mercado BRL", "Proventos BRL", "Resultado BRL", "Rentabilidade %", "Valor inicial BRL", "Valor final BRL"],
    ...assets.map((asset) => [
      date,
      source,
      asset.ticker,
      asset.name,
      asset.classLabel,
      asset.currency,
      asset.marketPnlBRL.toFixed(2),
      asset.incomePnlBRL.toFixed(2),
      asset.changeBRL.toFixed(2),
      asset.changePct.toFixed(4),
      asset.startValueBRL.toFixed(2),
      asset.valueBRL.toFixed(2),
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
}
