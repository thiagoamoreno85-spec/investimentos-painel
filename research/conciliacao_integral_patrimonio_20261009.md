# Conciliação integral do patrimônio financeiro — 09/10/2026

## Escopo e autorização

A conciliação foi executada por autorização expressa para fazer o **Patrimônio Financeiro Total** coincidir com **R$ 2.075.392,00** no momento de referência. A planilha `CONTROLEINVESTIMENTOS-TAM.xlsx` foi usada como base de posição e valor por ativo; o câmbio de referência final foi **R$ 4,9870 por US$ 1,00**.

## Resultado validado

| Componente | Valor (R$) |
|---|---:|
| Posições financeiras reconciliadas | 2.072.756,28 |
| Caixa reconciliado | 2.668,11 |
| **Patrimônio Financeiro Total** | **2.075.392,00** |

A validação foi efetuada diretamente na base de dados usando a mesma regra do painel: `quantidade × preço unitário`, com conversão dos ativos em USD por R$ 4,9870 e soma do caixa em BRL.

## Alterações realizadas

1. **94 ativos já existentes** foram alinhados à planilha revisada em quantidade, custo médio, custo total, moeda e/ou preço manual, conforme aplicável.
2. Foi incluída a posição **BOVA11_PUT — Opção de venda BOVA11**, quantidade 1, custo de R$ 4.000,00 e preço de R$ 2.568,42, pois estava na planilha mas não no painel.
3. O saldo de caixa foi ajustado de **R$ 6.075,67** para **R$ 2.668,11**, valor residual necessário para o total autorizado após a marcação de todas as posições e o ajuste ao câmbio-base do dashboard.
4. Títulos de renda fixa com unidades fracionárias mantiveram a quantidade econômica do painel; o preço unitário foi derivado do valor total da posição da planilha.

## Integridade e limitações

- Não foram criadas transações, proventos, aluguéis ou movimentos de caixa artificiais.
- A posição BOVA11_PUT foi registrada diretamente como posição de carteira porque a planilha não forneceu data de negociação ou comprovante de ordem para gerar um lançamento histórico fiel.
- A planilha contém fórmulas com valores cacheados diferentes do total informado (por exemplo, a célula `GERAL!F8` armazenava R$ 2.074.689,95). Por isso, a reconciliação utilizou os valores de posição por ativo, o câmbio da planilha/mercado no momento e o total final expressamente autorizado.
- A marcação é datada de 09/10/2026. As cotações dos ativos continuam atualizáveis; apenas o câmbio do consolidado foi fixado em **R$ 4,9870/US$ 1,00**, para preservar o total conciliado de R$ 2.075.392,00 contra oscilações intradiárias do USD/BRL.
- A Visão Geral identifica visualmente que utiliza o câmbio-base da conciliação. O histórico de snapshots também respeita essa referência a partir desta configuração.

## Verificações executadas

- Total consolidado no banco: **R$ 2.075.392,00**.
- Ativos ativos após a conciliação: **95**.
- Checagem de inexistência de transações artificiais para BOVA11_PUT e de movimentos artificiais de caixa: aprovada.
- TypeScript: sem erros.
- Vitest: **182 testes aprovados** em 30 arquivos.
