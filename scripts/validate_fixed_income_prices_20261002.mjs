import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const USER_ID = 1;
const SOURCE_TAG = "[IMPORT_RF_VALORES_20261002]";
const EXPECTED_REFERENCE_DATE = "2026-10-02";

const EXISTING_POSITIONS = [
  ["CDB_FIBRA_0528", "1.00000000", "930.94000000", "930.94", "1426.52000000"],
  ["CDB_C6_0227", "1.00000000", "1058.98000000", "1058.98", "1534.77000000"],
  ["CDB_BMG_0627", "1.00000000", "1146.71000000", "1146.71", "1529.83000000"],
  ["CDB_BMG_0127", "1.00000000", "3999.95000000", "3999.95", "5008.39000000"],
  ["CDB_AGIBANK_0128", "1.00000000", "974.77000000", "974.77", "1204.77000000"],
  ["CRI_MRV_FLEX_0333", "1.00000000", "499.69000000", "499.69", "338.03000000"],
  ["CDB_FIBRA_0732", "1.00000000", "4000.00000000", "4000.00", "4757.97000000"],
  ["CDB_FIBRA_0929", "1.00000000", "5000.00000000", "5000.00", "5848.39000000"],
  ["NTN_B_052030", "1.00000000", "4234.47000000", "4234.47", "4567.47000000"],
  ["CDB_C6_1229", "1.00000000", "5000.00000000", "5000.00", "5918.36000000"],
  ["CDB_FIBRA_0132", "1.00000000", "5000.00000000", "5000.00", "5682.97000000"],
  ["DEB_RAIZEN_0630", "1.00000000", "7818.69000000", "7818.69", "4109.36000000"],
  ["CDB_PINE_1026", "1.00000000", "2949.31000000", "2949.31", "3508.42000000"],
  ["CRA_MINERVA_0730", "1.00000000", "1054.30000000", "1054.30", "935.40000000"],
  ["TESOURO_SELIC_31", "1.00000000", "33950.73000000", "33950.73", "34833.93000000"],
  ["NTN_B_082032", "1.29000000", "3097.14728682", "3995.32", "3097.14728682"],
  ["CDB_XP_0828", "1.00000000", "7000.00000000", "7000.00", "7138.18000000"],
  ["CDB_C6_IPCA_084_0830", "1.00000000", "7000.00000000", "7000.00", "7071.45000000"],
  ["CDB_C6_CONSIG_0229", "1.00000000", "3189.03000000", "3189.03", "3203.51000000"],
  ["CDB_XP_INV", "1.00000000", "2000.00000000", "2000.00", "2021.05000000"],
  ["CDB_PINE_IPCA_0825_0931", "3.00000000", "1000.00000000", "3000.00", "1001.97000000"],
  ["CRA_MARFRIG_IPCA_1090_0731", "4.00000000", "1087.18250000", "4348.73", "1051.21750000"],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const connection = await createConnection(process.env.DATABASE_URL);
try {
  const tickers = EXISTING_POSITIONS.map(([ticker]) => ticker);
  const [assets] = await connection.execute(
    `SELECT ticker, totalQuantity, averageCost, totalCost, lastPrice, priceReferenceDate
     FROM assets
     WHERE userId = ? AND ticker IN (${tickers.map(() => "?").join(",")})`,
    [USER_ID, ...tickers]
  );
  assert(assets.length === EXISTING_POSITIONS.length, "Quantidade de posições existentes diverge da aprovação.");
  const assetByTicker = new Map(assets.map((row) => [row.ticker, row]));

  for (const [ticker, quantity, averageCost, totalCost, lastPrice] of EXISTING_POSITIONS) {
    const asset = assetByTicker.get(ticker);
    assert(asset, `Ativo ausente: ${ticker}`);
    assert(String(asset.totalQuantity) === quantity, `Quantidade alterada indevidamente: ${ticker}`);
    assert(String(asset.averageCost) === averageCost, `Custo médio alterado indevidamente: ${ticker}`);
    assert(String(asset.totalCost) === totalCost, `Custo total alterado indevidamente: ${ticker}`);
    assert(String(asset.lastPrice) === lastPrice, `Preço manual divergente: ${ticker}`);
    assert(new Date(asset.priceReferenceDate).toISOString().slice(0, 10) === EXPECTED_REFERENCE_DATE, `Data-base divergente: ${ticker}`);
  }

  const [prefixadoRows] = await connection.execute(
    `SELECT a.id, a.ticker, a.name, a.totalQuantity, a.averageCost, a.totalCost, a.lastPrice,
            a.issuer, a.maturityDate, a.maturityLabel, a.priceReferenceDate,
            t.id AS transactionId, t.type, t.quantity AS transactionQuantity, t.unitPrice,
            t.totalValue, t.fees, t.transactionDate, t.notes
     FROM assets a
     JOIN transactions t ON t.assetId = a.id AND t.userId = a.userId
     WHERE a.userId = ? AND a.ticker = 'TESOURO_PRE_0129' AND t.notes LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`]
  );
  assert(prefixadoRows.length === 1, "Cadastro ou transação do Tesouro Prefixado não é único.");
  const prefixado = prefixadoRows[0];
  assert(String(prefixado.totalQuantity) === "8.02000000", "Quantidade do Tesouro Prefixado incorreta.");
  assert(String(prefixado.averageCost) === "748.84039900", "Custo unitário do Tesouro Prefixado incorreto.");
  assert(String(prefixado.totalCost) === "6005.70", "Custo total do Tesouro Prefixado incorreto.");
  assert(String(prefixado.lastPrice) === "748.84039900", "Preço manual do Tesouro Prefixado incorreto.");
  assert(prefixado.issuer === "Tesouro Nacional", "Emissor do Tesouro Prefixado incorreto.");
  assert(new Date(prefixado.maturityDate).toISOString().slice(0, 10) === "2029-01-01", "Vencimento do Tesouro Prefixado incorreto.");
  assert(String(prefixado.totalValue) === "6005.70" && String(prefixado.fees) === "0.00", "Transação do Tesouro Prefixado incorreta.");

  const [summaryRows] = await connection.execute(
    `SELECT COUNT(*) AS activeTitles,
            CAST(SUM(lastPrice * totalQuantity) AS DECIMAL(18,2)) AS totalMarkedValue,
            CAST(SUM(totalCost) AS DECIMAL(18,2)) AS totalCost
     FROM assets
     WHERE userId = ? AND assetClass = 'renda_fixa' AND totalQuantity > 0`,
    [USER_ID]
  );
  const summary = summaryRows[0];
  assert(Number(summary.activeTitles) === 23, "Quantidade de títulos ativos divergente.");
  assert(String(summary.totalMarkedValue) === "117850.57", "Total de renda fixa divergente.");

  const [cashRows] = await connection.execute(
    `SELECT COUNT(*) AS count FROM cash_movements WHERE userId = ? AND description LIKE ?`,
    [USER_ID, `%${SOURCE_TAG}%`]
  );
  assert(Number(cashRows[0].count) === 0, "Movimento de caixa indevido criado para esta atualização.");

  const [fgtsRows] = await connection.execute(
    `SELECT totalQuantity, averageCost, totalCost, lastPrice FROM assets WHERE userId = ? AND ticker = 'FGTS'`,
    [USER_ID]
  );
  assert(fgtsRows.length === 1, "Posição FGTS não localizada.");
  assert(String(fgtsRows[0].totalQuantity) === "1.00000000", "FGTS alterado indevidamente.");
  assert(String(fgtsRows[0].averageCost) === "50762.01000000", "Custo do FGTS alterado indevidamente.");
  assert(String(fgtsRows[0].lastPrice) === "57594.42000000", "Preço do FGTS alterado indevidamente.");

  console.log(JSON.stringify({
    status: "valid",
    existingPriceUpdates: EXISTING_POSITIONS.length,
    prefixado: { assetId: prefixado.id, transactionId: prefixado.transactionId, totalValue: prefixado.totalValue },
    fixedIncomeSummary: summary,
    cashMovementsCreated: 0,
    fgts: fgtsRows[0],
  }, null, 2));
} finally {
  await connection.end();
}
