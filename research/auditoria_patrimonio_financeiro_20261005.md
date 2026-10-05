# Auditoria do Patrimônio Financeiro — 05/10/2026

**Escopo:** diagnóstico do cartão **“Patrimônio Financeiro Total”** exibido na Visão Geral, de suas fontes de dados, da trilha de transações e dos saldos de caixa.

**Data e horário da verificação:** 05/10/2026, aproximadamente 11h BRT.  
**Dados alterados:** **nenhum**. Esta auditoria é somente leitura.

> O valor de **R$ 1.982.415,13** não decorre de erro aritmético no cartão. Ele fecha com as posições e a taxa USD/BRL lidas pelo painel no instante da captura. O problema é de **integridade e data-base dos dados que alimentam a fórmula**.

---

## 1. Fórmula verificada do cartão

**Código verificado:** `shared/homePortfolioSummary.ts`, função `buildHomePortfolioSummary`.

O cartão financeiro soma:

1. posições em BRL: `quantidade × último preço`;
2. posições em USD: `quantidade × último preço × USD/BRL`;
3. saldo atual da tabela `cash_balance`;
4. exclui ativos legados da classe `caixa`, evitando dupla contagem.

O cartão **não inclui** imóveis, veículos, créditos particulares ou passivos patrimoniais. Esses componentes pertencem ao Net Worth Consolidado, em cartão separado.

### Reconciliação da captura

| Componente | Base apurada | Valor em BRL |
|---|---:|---:|
| Posições em BRL | Renda variável Brasil, fundos e renda fixa | R$ 1.419.757,57 |
| Posições em USD | US$ 111.826,32 × câmbio implícito de R$ 4,977199 | R$ 556.581,89 |
| Caixa | Snapshot XP registrado em 01/10 | R$ 6.075,67 |
| **Patrimônio financeiro exibido** | Soma dos itens acima | **R$ 1.982.415,13** |

A taxa implícita acima foi obtida pela própria captura: `(R$ 1.982.415,13 − R$ 1.419.757,57 − R$ 6.075,67) ÷ US$ 111.826,32`.

Na nova consulta, poucos minutos depois, o provedor retornou USD/BRL de **R$ 4,9751**, o que produziria cerca de **R$ 1.982.180,36**. A diferença de aproximadamente **R$ 234,77** é exclusivamente cambial e compatível com uma consulta de câmbio em tempo real separada da consulta dos ativos; não é um erro de soma.

---

## 2. Fundamentos verificados — o que está correto

| Verificação | Resultado | Evidência |
|---|---|---|
| Dupla contagem entre ativo financeiro e ativo patrimonial | Não identificada na fórmula do cartão financeiro | `buildHomePortfolioSummary` soma somente `assets` e `cash_balance` |
| Tickers ativos duplicados | Não identificados | Consulta por ticker, classe e moeda não retornou duplicidade ativa |
| Posições zeradas | Não afetam o total | A consulta de ativos retorna somente `totalQuantity > 0` |
| Aritmética do cartão | Correta | Reconciliação acima reproduz R$ 1.982.415,13 |
| Cotações de bolsa no fim de semana | Esperado que reflitam o fechamento de sexta-feira, 02/10 | A captura foi feita em domingo, 05/10; os preços líquidos estavam datados de 02/10 |
| Separação entre patrimônio financeiro e net worth | Correta | Patrimonial é lido por rota própria e não entra no cartão financeiro |

---

## 3. Fragilidades e riscos identificados

### 3.1. Risco crítico: compra do Tesouro Prefixado aparece sem baixa da origem dos recursos

**Fato verificado:**

- o Tesouro Prefixado 2029 foi cadastrado em **01/10/2026** por **R$ 6.005,70**;
- o saldo de caixa exibido é o snapshot XP de **R$ 6.075,67**, marcado em 01/10 e referente ao extrato de setembro;
- o FGTS mantém valor de **R$ 55.086,84**;
- foi informado que **R$ 5.800,00 saíram do FGTS para a conta de investimento** para compor essa aplicação; o complemento é de **R$ 205,70**.

A compra foi corretamente criada como ativo, mas as fontes que a financiaram permaneceram integralmente no painel. Assim, se a transferência de R$ 5.800,00 e o complemento de R$ 205,70 efetivamente ocorreram, o painel está **superestimado em R$ 6.005,70**:

| Efeito pendente | Valor |
|---|---:|
| Baixa do FGTS para a aplicação | -R$ 5.800,00 |
| Baixa do caixa para complementar o Tesouro | -R$ 205,70 |
| **Sobreavaliação potencial total** | **-R$ 6.005,70** |

**Cenário aritmético, condicionado à confirmação das origens:**

`R$ 1.982.415,13 − R$ 6.005,70 = R$ 1.976.409,43`.

> Não foi feita baixa automática, pois uma saída de FGTS e a alteração de caixa são movimentações financeiras que exigem confirmação e trilha de conciliação.

---

### 3.2. Risco alto: quantidade de BTC Binance diverge da última posição confirmada

**Fatos verificados:**

- posição BTC Binance confirmada em 30/09: **0,02371000 BTC**;
- posição hoje cadastrada: **0,02610000 BTC**;
- diferença: **0,00239000 BTC**;
- à cotação armazenada de US$ 84.506,71 e ao câmbio da captura, essa diferença equivale a aproximadamente **R$ 1.005,25**.

Foram encontrados dois lançamentos criados em 02/10, sem nota, comprovante, chave de origem ou script correspondente no repositório:

| ID | Quantidade BTC | Valor registrado | Data da transação | Criação no banco |
|---:|---:|---:|---|---|
| 990001 | 0,00244000 | US$ 204,05 | 02/10/2026 | 02/10/2026 18:42 BRT |
| 1020001 | 0,00540000 | US$ 451,58 | 02/10/2026 | 02/10/2026 18:44 BRT |

Os dois lançamentos somam 0,00784000 BTC e **não reconciliam diretamente** com a diferença atual de 0,00239000 BTC porque a posição Binance já tinha saldo histórico sem custo/trilha completa. Portanto:

- há **inconsistência comprovada** entre posição, transações e última confirmação;
- não há prova suficiente para apagar qualquer lançamento sem o extrato da Binance ou orientação expressa;
- o efeito material máximo diretamente associado à diferença de posição versus a última confirmação é **R$ 1.005,25**.

---

### 3.3. Risco alto: custo de BNB está em moeda incompatível e distorce o lucro

**Fato verificado:** o cadastro de BNB está com:

- moeda do ativo: **USD**;
- quantidade: **1,56109000 BNB**;
- custo médio armazenado: **3.602,00**;
- valor de origem informado no inventário: **R$ 3.602,00** por BNB.

O código converte tanto o valor de mercado quanto o custo de ativos USD pelo câmbio. Logo, o custo de BNB está sendo tratado como US$ 3.602,00 e convertido novamente para BRL.

| Métrica na taxa implícita da captura | Como está | Se R$ 3.602,00 for confirmado como custo em BRL |
|---|---:|---:|
| Custo total considerado | R$ 27.987,02 | R$ 5.623,05 |
| Valor de mercado | R$ 5.947,44 | R$ 5.947,44 |
| Resultado do BNB | -R$ 22.039,59 | +R$ 324,39 |
| Distorção no lucro consolidado |  | **R$ 22.363,98** |

**Impacto:** este erro não altera o patrimônio total, mas torna o cartão de **lucro/prejuízo** materialmente subavaliado. Sob a hipótese de confirmação da moeda BRL do custo, o lucro exibido de aproximadamente R$ 369,6 mil passaria para cerca de **R$ 392,0 mil** (aprox. 24,7%), mantendo o mesmo valor de mercado.

---

### 3.4. Risco alto: histórico transacional não é base segura para recálculo automático

Há divergências entre quantidade/custo das posições atuais e a soma das transações em diversas classes. Exemplos:

| Ativo | Quantidade atual | Quantidade líquida nas transações | Observação |
|---|---:|---:|---|
| SBSP3 | 3.585 | 6.093 | Divergência material |
| CMIN3 | 18.457 | 18.357 | Divergência de 100 ações |
| CRWD | 16 | 4 | Divergência material |
| INDA | 123,90519 | 92,94306 | Divergência material |
| AURY | 101,99020 | 0 | Sem transação de origem |
| FTT | 7,274513 | 0 | Sem transação de origem |

Além disso, existem títulos de renda fixa cuja transação usa uma unidade econômica diferente da posição. Exemplo:

| Título | Quantidade cadastrada | Quantidade no histórico | Preço marcado atual |
|---|---:|---:|---:|
| CDB XP — AGO/2028 | 1 título | 7.000 | R$ 7.138,18 |

A função genérica `recalculateAsset` recalcula quantidade a partir do histórico sem distinguir “número de títulos” de “valor aplicado”. Se essa rotina for aplicada ao CDB XP acima, poderia transformar 1 título em 7.000 unidades e multiplicar artificialmente o valor da posição para dezenas de milhões de reais.

> **Não executar recálculo global de posições enquanto a semântica de quantidade da renda fixa não for separada e validada.**

Esse é um defeito de integridade preventivo: não explica sozinho o total da captura, mas é capaz de gerar uma distorção muito grande em operação futura de inclusão, exclusão ou edição de transação.

---

### 3.5. Risco moderado: preços manuais sem data-base confiável ou defasados

| Ativo | Valor marcado | Data do último preço | Situação |
|---|---:|---|---|
| SISPRIME | R$ 6.689,16 | 22/04/2026 | 165 dias sem atualização |
| BNP Paribas Rubi | R$ 56.175,61 | 04/09/2026 | 30 dias sem atualização |
| TREND Investback | R$ 0,01 | 02/10/2026 | Preço incompatível com custo de R$ 59,98; requer confirmação |
| Fundos e renda fixa atualizados | R$ 486.085,04 em conjunto | 02/10/2026 | Marcação manual; adequada como data-base, mas não é cotação de 05/10 |

Esses itens não podem ser corrigidos por inferência. Eles precisam de extrato/cota da instituição ou confirmação do valor correto.

---

### 3.6. Risco moderado: saldo de caixa tem data-base anterior às posições recentes

O saldo de caixa de **R$ 6.075,67** foi importado como snapshot do extrato XP em 01/10, com referência ao encerramento de setembro. O cartão financeiro, entretanto, também inclui operações e posições registradas em 01 e 02/10.

A fórmula trata o caixa como uma fotografia independente — decisão adequada para não recriar saldo a partir de movimentos históricos —, mas o card não evidencia suficientemente a sua data-base. Isso mistura dados de datas diferentes e pode levar a uma leitura de “saldo atual” que não está conciliada.

---

## 4. Alegações que **não** foram feitas

- Não foi identificada dupla contagem matemática entre caixa e uma classe de ativo na função do cartão.
- Não foi afirmado que SISPRIME, BNP Rubi ou TREND Investback tenham valor econômico incorreto; eles estão apenas sem evidência de atualização suficiente.
- Não foi afirmado que as duas operações BTC sem nota sejam definitivamente indevidas; sua origem não foi localizada no repositório nem em uma chave de importação.
- Não foi alterado qualquer ativo, transação, provento, caixa, FGTS ou preço durante esta auditoria.

---

## 5. Plano de reforço e correção recomendado

### Prioridade 1 — conciliação financeira, mediante confirmação

1. Confirmar a baixa de **R$ 5.800,00** do FGTS e a utilização de **R$ 205,70** do caixa para o Tesouro Prefixado 2029.
2. Atualizar a data-base do saldo de caixa após a compra, evitando dupla contagem de fonte e destino.
3. Confirmar a posição real de BTC na Binance com extrato/exportação de trades antes de remover ou manter os dois lançamentos sem origem.
4. Confirmar a moeda do custo original de BNB. Se foi realmente BRL, corrigir a moeda/base de custo sem alterar a quantidade ou cotação atual.

### Prioridade 2 — blindagem técnica

1. Bloquear a rotina de recálculo genérico para ativos de renda fixa com unidade de posição diferente da unidade da transação.
2. Adotar tipos explícitos para renda fixa: `quantidade_titulos`, `valor_aplicado`, `preco_unitario` e `valor_marcado`.
3. Exigir origem/chave de conciliação ou justificativa em toda transação inserida fora de importação confirmada.
4. Exibir no card de patrimônio: **data-base do caixa**, **data-base da cotação USD/BRL** e aviso quando uma posição manual exceder 30 dias.

### Prioridade 3 — qualidade de marcação

1. Atualizar SISPRIME, BNP Rubi e TREND Investback com informes/cotas oficiais.
2. Manter a marcação de renda fixa em processo manual auditável, com data-base e fonte.
3. Executar conciliação periódica de posição versus extratos, sem recalcular automaticamente ativos legados.

---

## 6. Conclusão operacional

O cartão de patrimônio é **aritmeticamente consistente**, mas o número não deve ser tratado como patrimônio financeiro plenamente conciliado até resolver, no mínimo:

1. a origem de R$ 6.005,70 do Tesouro Prefixado;
2. a diferença de BTC Binance;
3. a moeda do custo de BNB;
4. o saldo de caixa com data-base posterior às operações de 01/10;
5. os preços manuais sem evidência recente.

O primeiro ajuste, se confirmado — baixa de FGTS e caixa que financiaram o Tesouro — reduz o total em **R$ 6.005,70**. O ajuste de BTC pode reduzir adicionalmente cerca de **R$ 1.005,25**, mas depende de confirmação documental. A correção de BNB altera essencialmente o lucro/prejuízo, não o valor total de mercado.
