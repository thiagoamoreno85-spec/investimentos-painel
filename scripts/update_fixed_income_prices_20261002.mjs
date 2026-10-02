import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "/home/ubuntu/investimentos-painel/.env", quiet: true });

const USER_ID = 1;
const PRICE_REFERENCE_AT = new Date("2026-10-02T00:00:00.000Z");
const PURCHASE_AT = new Date("2026-10-01T17:02:00.000Z");
const SOURCE_TAG = "[IMPORT_RF_VALORES_20261002]";

/**
 * Valores totais de posição recebidos na tabela do usuário em 02/10/2026.
 * Os preços unitários foram calculados somente quando há quantidade fracionada
 * ou superior a um título. Custo, quantidade e caixa das posições existentes
 * não são modificados por este script.
 */
const PRICE_UPDATES = [
  { ticker: "CDB_FIBRA_0528", expectedLastPrice: "1426.52000000", newUnitPrice: "1426.52000000" },
  { ticker: "CDB_C6_0227", expectedLastPrice: "1534.77000000", newUnitPrice: "1534.77000000" },
  { ticker: "CDB_BMG_0627", expectedLastPrice: "1529.83000000", newUnitPrice: "1529.83000000" },
  { ticker: "CDB_BMG_0127", expectedLastPrice: "5008.39000000", newUnitPrice: "5008.39000000" },
  { ticker: "CDB_AGIBANK_0128", expectedLastPrice: "1204.77000000", newUnitPrice: "1204.77000000" },
  { ticker: "CRI_MRV_FLEX_0333", expectedLastPrice: "338.03000000", newUnitPrice: "338.03000000" },
  { ticker: "CDB_FIBRA_0732", expectedLastPrice: "4757.97000000", newUnitPrice: "4757.97000000" },
  { ticker: "CDB_FIBRA_0929", expectedLastPrice: "5848.39000000", newUnitPrice: "5848.39000000" },
  { ticker: "NTN_B_052030", expectedLastPrice: "4567.47000000", newUnitPrice: "4567.47000000" },
  { ticker: "CDB_C6_1229", expectedLastPrice: "5918.36000000", newUnitPrice: "5918.36000000" },
  { ticker: "CDB_FIBRA_0132", expectedLastPrice: "5682.97000000", newUnitPrice: "5682.97000000" },
  { ticker: "DEB_RAIZEN_0630", expectedLastPrice: "4203.23000000", newUnitPrice: "4109.36000000" },
  { ticker: "CDB_PINE_1026", expectedLastPrice: "3467.80000000", newUnitPrice: "3508.42000000" },
  { ticker: "CRA_MINERVA_0730", expectedLastPrice: "944.96000000", newUnitPrice: "935.40000000" },
  { ticker: "TESOURO_SELIC_31", expectedLastPrice: "34476.82000000", newUnitPrice: "34833.93000000" },
  { ticker: "NTN_B_082032", expectedLastPrice: "3097.14728682", newUnitPrice: "3097.14728682" },
  { ticker: "CDB_XP_0828", expectedLastPrice: "7061.73000000", newUnitPrice: "7138.18000000" },
  { ticker: "CDB_C6_IPCA_084_0830", expectedLastPrice: "7010.08000000", newUnitPrice: "7071.45000000" },
  { ticker: "CDB_C6_CONSIG_0229", expectedLastPrice: "3189.03000000", newUnitPrice: "3203.51000000" },
  { ticker: "CDB_XP_INV", expectedLastPrice: "2000.00000000", newUnitPrice: "2021.05000000" },
  { ticker: "CDB_PINE_IPCA_0825_0931", expectedLastPrice: "1000.00000000", newUnitPrice: "1001.97000000" },
  { ticker: "CRA_MARFRIG_IPCA_1090_0731", expectedLastPrice: "1087.18250000", newUnitPrice: "1051.21750000" },
];

const PREFIXADO = {
  ticker: "TESOURO_PRE_0129",
  name: "Tesouro Prefixado 2029 (Pré 13,90% a.a.)",
  quantity: "8.02000000",
  unitPrice: "748.84039900",
  totalValue: "6005.70",
  issuer: "Tesouro Nacional",
  maturityDate: "2029-01-01",
  maturityLabel: "jan/2029",
  notes:
    "Compra liquidada | Tesouro Prefixado 2029 | Taxa: Pré 13,90% a.a. | Vencimento: 2029-01-01 | " +
    "Quantidade: 8,02 | Valor: R$ 6005,70 | Fonte: tabela e ordem do Tesouro Direto enviada pelo usuário | " +
    `${SOURCE_TAG} | Sem movimento de caixa: origem FGTS e complemento de R$ 205,70 permanecem em conciliação separada.`,
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const connection = await createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();

  const tickers = PRICE_UPDATES.map(({ ticker }) => ticker);
  const [currentRows] = await connection.execute(
    `SELECT id, ticker, totalQuantity, averageCost, totalCost, lastPrice
     FROM assets
     WHERE userId = ? AND ticker IN (${tickers.map(() => "?").join(",")})
     FOR UPDATE`,
    [USER_ID, ...tickers]
  );

  assert(currentRows.length === PRICE_UPDATES.length, "A lista de títulos cadastrados divergiu da prévia; atualização cancelada.");
  const currentByTicker = new Map(currentRows.map((row) => [row.ticker, row]));

  for (const update of PRICE_UPDATES) {
    const current = currentByTicker.get(update.ticker);
    assert(current, `Título não encontrado: ${update.ticker}`);
    assert(
      String(current.lastPrice) === update.expectedLastPrice,
      `Preço atual inesperado em ${update.ticker}: esperado ${update.expectedLastPrice}, encontrado ${current.lastPrice}. Atualização cancelada.`
    );
  }

  const [existingPrefixado] = await connection.execute(
    `SELECT id FROM assets WHERE userId = ? AND ticker = ? FOR UPDATE`,
    [USER_ID, PREFIXADO.ticker]
  );
  assert(existingPrefixado.length === 0, "Tesouro Prefixado 2029 já existe; cadastro duplicado bloqueado.");

  for (const update of PRICE_UPDATES) {
    const [result] = await connection.execute(
      `UPDATE assets
       SET lastPrice = ?, lastPriceUpdatedAt = ?, priceReferenceDate = ?
       WHERE id = ? AND userId = ?`,
      [update.newUnitPrice, PRICE_REFERENCE_AT, PRICE_REFERENCE_AT, currentByTicker.get(update.ticker).id, USER_ID]
    );
    assert(result.affectedRows === 1, `Falha ao atualizar o preço de ${update.ticker}.`);
  }

  const [assetResult] = await connection.execute(
    `INSERT INTO assets (
       userId, ticker, name, assetClass, currency, totalQuantity, averageCost, totalCost,
       lastPrice, lastPriceUpdatedAt, issuer, maturityDate, maturityLabel, priceReferenceDate
     ) VALUES (?, ?, ?, 'renda_fixa', 'BRL', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      USER_ID,
      PREFIXADO.ticker,
      PREFIXADO.name,
      PREFIXADO.quantity,
      PREFIXADO.unitPrice,
      PREFIXADO.totalValue,
      PREFIXADO.unitPrice,
      PRICE_REFERENCE_AT,
      PREFIXADO.issuer,
      PREFIXADO.maturityDate,
      PREFIXADO.maturityLabel,
      PRICE_REFERENCE_AT,
    ]
  );
  const prefixadoAssetId = assetResult.insertId;

  const [transactionResult] = await connection.execute(
    `INSERT INTO transactions (userId, assetId, type, quantity, unitPrice, totalValue, fees, transactionDate, notes)
     VALUES (?, ?, 'buy', ?, ?, ?, '0.00', ?, ?)`,
    [USER_ID, prefixadoAssetId, PREFIXADO.quantity, PREFIXADO.unitPrice, PREFIXADO.totalValue, PURCHASE_AT, PREFIXADO.notes]
  );

  const [summaryRows] = await connection.execute(
    `SELECT
       COUNT(*) AS activeTitles,
       CAST(SUM(lastPrice * totalQuantity) AS DECIMAL(18,2)) AS totalMarkedValue,
       CAST(SUM(totalCost) AS DECIMAL(18,2)) AS totalCost
     FROM assets
     WHERE userId = ? AND assetClass = 'renda_fixa' AND totalQuantity > 0`,
    [USER_ID]
  );

  await connection.commit();
  console.log(
    JSON.stringify(
      {
        status: "committed",
        priceReferenceDate: PRICE_REFERENCE_AT.toISOString(),
        priceUpdates: PRICE_UPDATES.length,
        prefixado: {
          assetId: prefixadoAssetId,
          transactionId: transactionResult.insertId,
          ticker: PREFIXADO.ticker,
          quantity: PREFIXADO.quantity,
          totalValue: PREFIXADO.totalValue,
        },
        fixedIncomeSummary: summaryRows[0],
        safeguards: {
          costsAndQuantitiesExistingPositions: "preserved",
          cashMovements: "not created",
          fgts: "not changed",
        },
      },
      null,
      2
    )
  );
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
