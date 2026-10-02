# Prévia de Importação — Extrato XP Setembro/2026

**Conta:** XP 496056 — Thiago de Aguirre Moreno  
**Período de movimentações:** 01/09/2026 a 30/09/2026  
**Data/hora de consulta do extrato:** 01/10/2026 às 14:10  
**Fontes confrontadas:** `Extrato496056SET.2026.xlsx` (102 movimentações) e PDF de 4 páginas.  
**Status:** importação integral aprovada e aplicada em 02/10/2026; validação concluída.

## Saldo de Caixa — Marcos Temporais

| Marco | Valor | Base |
|---|---:|---|
| Saldo inicial reconstruído em 01/09 | R$ 563,18 | Primeiro lançamento de 01/09 menos o respectivo crédito |
| Soma das 102 movimentações de setembro | R$ 3.460,29 | XLSX/PDF |
| Último saldo do período, em 30/09 | R$ 4.023,47 | Última linha de movimentação do extrato |
| Saldo disponível na consulta, em 01/10 às 14:10 | R$ 6.075,67 | Cabeçalho do extrato |
| Diferença posterior ao período | R$ 2.052,20 | Movimentações de 01/10 não detalhadas neste extrato |

> A conciliação das 102 movimentações de setembro fecha em **R$ 4.023,47**. O extrato também informa **R$ 6.075,67** como saldo disponível na data de consulta; como as movimentações de 01/10 não estão listadas, esse valor será tratado como **marcação de saldo corrente**, e não como fechamento de setembro.

## Créditos para Importação

### Aluguéis de ações — valores líquidos

Cada aluguel será registrado como provento de caixa do tipo `outro`, pelo valor líquido mensal por ativo. A nota preservará bruto, IRRF e taxa de intermediação.

| Ativo | Bruto | IRRF | Taxas | Líquido proposto |
|---|---:|---:|---:|---:|
| AURE3 | R$ 0,16 | -R$ 0,03 | -R$ 0,04 | R$ 0,09 |
| AXIA3 | R$ 6,53 | -R$ 1,46 | -R$ 1,96 | R$ 3,11 |
| BBAS3 | R$ 0,94 | -R$ 0,20 | -R$ 0,28 | R$ 0,46 |
| BRAV3 | R$ 107,34 | -R$ 24,14 | -R$ 32,98 | R$ 50,22 |
| CMIN3 | R$ 3.884,07 | -R$ 873,90 | -R$ 1.305,53 | R$ 1.704,64 |
| CYRE3 | R$ 317,31 | -R$ 71,38 | -R$ 103,98 | R$ 141,95 |
| KLBN11 | R$ 0,05 | -R$ 0,01 | -R$ 0,01 | R$ 0,03 |
| MBRF3 | R$ 911,07 | -R$ 204,95 | -R$ 292,35 | R$ 413,77 |
| SBSP3 | R$ 4,23 | -R$ 0,95 | -R$ 1,26 | R$ 2,02 |
| SUZB3 | R$ 0,24 | -R$ 0,05 | -R$ 0,07 | R$ 0,12 |
| TTEN3 | R$ 9,26 | -R$ 2,08 | -R$ 2,78 | R$ 4,40 |
| VALE3 | R$ 5,72 | -R$ 1,28 | -R$ 1,71 | R$ 2,73 |
| **Total** | **R$ 5.246,92** | **-R$ 1.180,43** | **-R$ 1.742,95** | **R$ 2.323,54** |

### Dividendos e rendimentos

| Data de pagamento | Ativo | Tipo | Valor |
|---|---|---|---:|
| 02/09/2026 | FLRY3 | Dividendo | R$ 76,99 |
| 14/09/2026 | ZAVI11 | Rendimento | R$ 17,52 |
| 25/09/2026 | XPML11 | Rendimento | R$ 103,04 |
| **Total** |  |  | **R$ 197,55** |

### Reembolsos de eventos corporativos

Serão registrados como provento de caixa do tipo `outro`, vinculados ao ativo e descritos como reembolso corporativo — sem rotulá-los como dividendo ordinário.

| Data | Ativo | Valor |
|---|---|---:|
| 01/09/2026 | BBDC4 | R$ 16,32 |
| 02/09/2026 | VALE3 | R$ 2.363,84 |
| 11/09/2026 | BBAS3 | R$ 247,18 |
| 15/09/2026 | BBDC4 | R$ 553,82 |
| 28/09/2026 | FLRY3 | R$ 211,91 |
| **Total** |  | **R$ 3.393,07** |

### Resgate de renda variável

| Data | Ativo vinculado | Natureza | Valor |
|---|---|---|---:|
| 22/09/2026 | AXIA3 | Entrada de caixa por resgate; não será tratada como provento | R$ 2.500,20 |

## Totais Propostos

| Categoria | Valor |
|---|---:|
| Aluguéis líquidos | R$ 2.323,54 |
| Dividendos e rendimentos | R$ 197,55 |
| Reembolsos corporativos | R$ 3.393,07 |
| Créditos de natureza de rendimento/provento | **R$ 5.914,16** |
| Resgate de renda variável (fora do rendimento) | R$ 2.500,20 |

## Auditoria de Duplicidade e Ressalvas

- Não há proventos cadastrados no painel para setembro/2026; os 12 aluguéis líquidos, 3 dividendos/rendimentos e 5 reembolsos estão aptos à importação, sujeitos à aprovação.
- Todos os 16 ativos vinculados foram localizados no painel, incluindo AXIA3 após a substituição de AXIA6.
- As aplicações em CDB Pine e CRA Marfrig de 25/09/2026 já constam no painel e também aparecem no extrato. Elas serão apenas usadas como conferência, sem novo lançamento.
- A compra de Tesouro IPCA+ 2032, registrada no painel em 30/09/2026 após confirmação do usuário, não aparece no extrato de setembro. Esse ponto permanecerá separado até a confirmação de liquidação no extrato posterior.
- A taxa e o vencimento do Tesouro Prefixado 2029 continuam pendentes de confirmação; esse título não integra esta prévia de extrato.
- O saldo disponível de R$ 6.075,67 é posterior ao período de movimentação. Sua atualização será uma marcação de saldo atual, não uma conciliação dos lançamentos de setembro.

## Proposta de Registro Após Aprovação

1. Criar 12 registros líquidos de aluguel de ações, com notas contendo bruto, IRRF e taxas.
2. Criar 3 registros de dividendo/rendimento e 5 registros de reembolso corporativo, todos com chave de origem do extrato para impedir duplicação.
3. Criar uma entrada de caixa de R$ 2.500,20 do resgate vinculado à AXIA3, sem atribuí-la a provento.
4. Atualizar o saldo de caixa para R$ 6.075,67, identificado como saldo disponível na consulta de 01/10/2026 às 14:10, sem criar movimento compensatório fictício.

## Registro de Execução

| Controle | Resultado verificado |
|---|---|
| Registros de aluguéis líquidos | 12 — R$ 2.323,54 |
| Dividendos e rendimentos | 3 — R$ 197,55 |
| Reembolsos corporativos | 5 — R$ 3.393,07 |
| Total registrado em proventos | 20 — R$ 5.914,16 |
| Resgate de renda variável AXIA3 | 1 entrada de caixa — R$ 2.500,20 |
| Saldo disponível registrado | R$ 6.075,67 em 01/10/2026 às 14:10 |
| Movimentos de compra/venda criados pela importação | Nenhum |
| Alteração do FGTS na importação | Nenhuma |
| Proteção contra duplicidade | Chave de origem `[IMPORT_XP_SET_2026]` |
| Validação técnica | TypeScript sem erros; 180 testes automatizados aprovados |
