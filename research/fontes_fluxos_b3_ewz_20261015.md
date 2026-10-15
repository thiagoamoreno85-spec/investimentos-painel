# Fontes para backfill de fluxos B3 e EWZ

**Verificação:** 15/10/2026, 15h08 BRT.

## B3 — série diária desde 01/07/2026

A página Dados de Mercado expõe uma série diária por categoria de investidor, informando que os dados são atualizados de acordo com a última divulgação de participação de investidores pela B3. A tabela inclui, por pregão: estrangeiro, institucional, pessoa física, instituição financeira e outros.

- Cobertura carregada: de 01/07/2026 a 13/10/2026 para o período solicitado.
- Métrica estrangeira: coluna `foreigners`.
- Métrica nacional agregada: soma de institucional, pessoa física, instituição financeira e outros; por construção, é a contrapartida da movimentação estrangeira e deve ser exibida como série separada.
- Unidade da fonte: BRL.
- Atualização da fonte em 15/10/2026: 14/10/2026 05:10, com defasagem de divulgação.

Fonte:
- https://www.dadosdemercado.com.br/fluxo
- https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/consultas/mercado-a-vista/dados-de-mercado/

## EWZ — fluxo offshore

EWZ é o iShares MSCI Brazil ETF, listado na NYSE Arca e gerido pela BlackRock/iShares. O site oficial informa NAV, patrimônio líquido e cotas em circulação em uma data pontual; em 14/10/2026 informou 312.350.000 cotas e patrimônio de US$ 13.275.134.596.

A ETF.com define fluxo de ETF como criação/resgate de cotas e informa que a ferramenta de Fund Flows aceita filtros por ticker, intervalo e período; sua extração pública direta não devolveu uma série histórica estruturada neste ambiente. A iShares tem dados atuais oficiais, mas a página pública inspecionada não expõe uma série diária de cotas/fluxos pronta para backfill. A CompaniesMarketCap, que atribui a origem da série à iShares, expõe uma série histórica diária de cotas em circulação; ela foi combinada ao fechamento diário do EWZ obtido por Yahoo Finance via Manus Data API.

Decisão metodológica:
- Para novas coletas: calcular proxy diário `variação de cotas em circulação × NAV` com fonte iShares, em USD.
- Para o histórico de 01/07/2026 a 13/10/2026: calcular `variação diária de cotas × fechamento diário do EWZ`, em USD. A série é um **proxy verificável**, não o fluxo oficial publicado do ETF; cotas e preço possuem fontes separadas.
- O EWZ não deve ser somado à B3, porque mede criação/resgate de cotas nos EUA, enquanto a B3 mede saldo de negociação por perfil de investidor no mercado local.

Fontes:
- https://www.ishares.com/us/products/239612/ishares-msci-brazil-etf
- https://companiesmarketcap.com/ishares-msci-brazil-etf/shares-outstanding/
- Yahoo Finance, consulta histórica `EWZ` 1d via Manus Data API em 15/10/2026
- https://www.etf.com/etfanalytics/etf-fund-flows-tool
- https://www.etf.com/sections/weekly-etf-flows/etf-inflows-top-41b-investors-pile-brazil-long-bonds
- https://www.etf.com/sections/daily-etf-flows/daily-etf-flows-brazil-etf-rises-top
