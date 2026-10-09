# Conciliação da Aba Ações — Planilha TAM Revisada × Painel

**Data da nova conferência:** 09/10/2026.  
**Fonte primária:** versão revisada de `CONTROLEINVESTIMENTOS-TAM.xlsx` enviada às 15h22.  
**Alterações executadas no painel:** BBDC4, AXIA3 e AXIA7 reconciliados após autorização expressa; preços, caixa e histórico de transações preservados.

## 1. Mudanças verificadas na nova planilha

A aba `AÇÕES` foi efetivamente atualizada. Ela agora traz três posições de renda variável nacional diferentes do painel:

| Ativo | Planilha revisada | Painel atual | Ajuste necessário para espelhar a planilha | Preço na planilha | Impacto de mercado na data da planilha |
|---|---:|---:|---:|---:|---:|
| BBDC4 | 1.190 | 1.182 | +8 | R$ 21,62 | +R$ 172,96 |
| AXIA3 | 1.149 | 1.104 | +45 | R$ 59,42 | +R$ 2.673,90 |
| AXIA7 | 131 | 186 | -55 | R$ 59,76 | -R$ 3.286,80 |
| **Efeito líquido** | — | — | — | — | **-R$ 439,94** |

> As demais 22 posições de renda variável nacional continuam idênticas entre a planilha revisada e o painel.

## 2. AXIA3 — resumo auxiliar ainda duplica a aquisição

A linha principal de carteira agora indica corretamente **1.149 ações**. No bloco-resumo do topo, contudo, a planilha mantém:

| Célula | Valor | Diagnóstico |
|---|---:|---|
| `Q3` | 1.149 | busca a posição consolidada da linha principal |
| `Q4` | 26 | aquisição informativa de 09/10/2026 |
| `Q5` | 1.175 | `=SUM(Q3:Q4)` duplica 26 ações |

O saldo final correto no bloco-resumo é **1.149 ações**; `Q5` deve referir-se a `Q3`, sem somar `Q4` novamente. Com o preço de R$ 59,42, a distorção do resumo é **R$ 1.544,92**.

## 3. Custo de AXIA3 exige escolha expressa

A planilha revisada informa custo unitário econômico de **R$ 42,10** para as 1.149 ações, equivalente a **R$ 48.372,90**. O painel está em R$ 42,97079710 por ação, com custo total atual de R$ 47.439,76.

| Alternativa | Quantidade | Custo médio | Custo total |
|---|---:|---:|---:|
| Usar a planilha revisada | 1.149 | R$ 42,10 | R$ 48.372,90 |
| Preservar o custo médio do painel | 1.149 | R$ 42,97079710 | R$ 49.373,45 |

O valor da planilha é **R$ 1.000,55** inferior ao custo que resultaria de manter o preço médio atual do painel. Como não há nota de negociação ou evento societário para essa diferença, a alteração de custo não deve ser inferida automaticamente.

## 4. Outros pontos ainda divergentes

| Ativo | Planilha | Painel | Leitura |
|---|---:|---:|---|
| PGEN | 206,40620 | 211,24817 | A compra de 4,84197 ações em 25/09 já está no painel, mas não foi lançada na planilha revisada. |
| INDA | 113,45150 | 123,90519 | A compra de 10,45369 cotas em 25/09 já está no painel, mas não foi lançada na planilha revisada. |
| URNM | 158,09749 | 157,99858 | Diferença de 0,09891 cota sem documento de suporte. |
| BTC Binance | 0,02614 | 0,02610 | Diferença de 0,00004 BTC sem documento de suporte. |
| Tesouro Selic 2031 | 1,00 / R$ 34.833,93 | 1,18 / R$ 41.104,04 | O painel aplica R$ 34.833,93 como preço unitário à nova quantidade; a marcação reconciliável de transição é R$ 38.432,47. |

As diferenças de unidade em Tesouro IPCA+ 2032, Tesouro Prefixado 2029, CDB Pine SET/2031 e CRA Marfrig JUL/2031 não exigem ajuste: os valores totais coincidem, embora a planilha use uma unidade de controle e o painel use quantidade econômica.

## 5. Base segura para ajustes

1. O painel somente deve receber os três **quantitativos explicitamente revisados**: BBDC4 1.190, AXIA3 1.149 e AXIA7 131.
2. O custo de AXIA3 deve ser escolhido entre a informação da planilha (R$ 42,10) e a preservação do custo atual do painel; não deve ser deduzido por aproximação.
3. As posições PGEN, INDA, URNM, BTC Binance e a marcação do Tesouro Selic permanecem separadas, pois requerem atualização na planilha, documento de origem ou confirmação específica.
4. A comparação do patrimônio total deve usar uma única data-base de cotação; o painel ainda possui, majoritariamente, preços de 02/10 e a planilha revisada apresenta valores de 09/10.

> Até a confirmação expressa do titular, esta conciliação permaneceu somente leitura.

## 6. Execução confirmada

Após a autorização do titular, o painel passou a refletir a planilha revisada:

| Ativo | Quantidade final | Custo médio final | Custo total final |
|---|---:|---:|---:|
| BBDC4 | 1.190 | R$ 15,20700000 | R$ 18.096,33 |
| AXIA3 | 1.149 | R$ 42,10000000 | R$ 48.372,90 |
| AXIA7 | 131 | R$ 30,10000000 | R$ 3.943,10 |

A reconciliação foi realizada diretamente nos campos de posição e custo, com trilha no script `RECONCILIACAO_ACOES_TAM_20261009`. Não foram criadas transações, movimentos de caixa, proventos ou dados simulados. A validação posterior confirmou que os preços antes existentes, o histórico de transações e o saldo de caixa de R$ 6.075,67 foram preservados.
