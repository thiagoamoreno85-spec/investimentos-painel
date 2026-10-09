# Auditoria Operacional Integral — Painel de Investimentos

**Data da auditoria:** 09/10/2026 (BRT)  
**Escopo:** rotinas de carteira, transações, caixa, importações, proventos, renda fixa, cotações, patrimônio consolidado, snapshots, automações, calendário e integridade do banco.  
**Método:** revisão estática do código, consultas **somente de leitura** ao banco, verificação das migrations, revisão dos logs dos jobs e execução da suíte de testes.  
**Alterações financeiras nesta auditoria:** nenhuma.

> **Conclusão executiva:** o painel está funcional como instrumento de visualização e já possui boas salvaguardas de interface, mas o operacional ainda não está pronto para ser tratado como livro-contábil totalmente autônomo. Há **quatro correções críticas**: jobs automáticos com falha, migrations não aplicadas no banco real, risco de alteração indevida de posição pela rotina genérica de transações e autorização insuficiente em exclusões. A recomendação é estabilizar esses pilares antes de ampliar automações ou novas telas.

---

## 1. Evidências verificadas

| Verificação | Resultado | Evidência |
|---|---:|---|
| Compilação TypeScript | Aprovada | `npx tsc --noEmit` em 09/10/2026 |
| Suíte automatizada | Aprovada | **30 arquivos / 182 testes** Vitest |
| Ativos cadastrados | 100 | consulta direta ao banco |
| Transações cadastradas | 163 | consulta direta ao banco |
| Proventos cadastrados | 116 | consulta direta ao banco |
| Movimentos de caixa | 22 | consulta direta ao banco |
| Snapshots patrimoniais | 5 | último em **31/08/2026** |
| Snapshots de performance diária | **0** | consulta direta ao banco |
| Agenda de eventos | 2 eventos | ambos de BRAV3, em junho de 2026 e ainda “agendados” |
| Jobs Heartbeat ativos | 3 | 2 de snapshot e 1 de notícias |
| Execução recente dos 3 jobs | **falha HTTP 403** | logs do Heartbeat |
| Migrations no repositório | 18 arquivos (`0000` a `0017`) | diretório `drizzle/` |
| Migrations aplicadas no banco | **10** | tabela `__drizzle_migrations` |

### 1.1. Leitura correta do consolidado

A Visão Geral usa `totalQuantity × lastPrice`, aplicando conversão somente quando `currency = USD`, e adiciona o saldo de caixa. Essa é a fórmula correta para o cartão principal.

O câmbio-base de conciliação atualmente cadastrado é **R$ 4,9870/US$**, com referência de 09/10/2026 e nota explícita de que preserva a marcação aprovada de **R$ 2.075.392,00**. Essa regra estabiliza o valor consolidado, mas exige governança: ela deve ser revisada ou liberada quando a intenção for voltar a acompanhar câmbio de mercado.

---

## 2. Achados críticos — corrigir antes de depender do operacional

### C1. Automação de snapshots e notícias está inoperante

**Fundamento verificado:** os três jobs ativos retornam `403 {"error":"cron-only endpoint"}`. As últimas execuções verificadas dos dois jobs de snapshot e do job de notícias falharam pelo mesmo motivo. Por consequência, existem apenas cinco snapshots patrimoniais antigos e **nenhum** registro em `daily_performance_snapshots`.

| Job | Situação | Consequência |
|---|---|---|
| `portfolio-snapshot-daily` | 403 em todas as execuções recentes | não cria snapshot diário |
| `portfolio-daily-snapshot` | 403 em todas as execuções recentes | não calcula retorno diário persistido |
| `news-auto-refresh` | 403 em todas as execuções recentes | notícias não são atualizadas automaticamente |

**Causa técnica:** os handlers aceitam apenas o cabeçalho `x-manus-cron-task-uid`, mas a integração atual do Heartbeat exige autenticação apropriada da requisição. O projeto possui a referência de implementação, mas os endpoints continuam no padrão antigo.

**Risco:** alto. A rentabilidade mensal passa a depender de reconstrução aproximada, os gráficos deixam de registrar fechamentos reais e as notícias automáticas ficam paradas.

**Correção proposta:**
1. substituir a checagem simples de cabeçalho por autenticação oficial do request do Heartbeat;
2. validar em produção com execução de teste controlada;
3. manter **um único** job de snapshot após o fechamento — os dois jobs atuais são redundantes e, quando corrigidos, disputarão a atualização da mesma data;
4. acompanhar a primeira semana de execuções no log.

> **Simplificação:** um job diário de snapshot é suficiente. A sugestão é manter o horário posterior ao fechamento/atualização de cotações e pausar o duplicado após validação.

---

### C2. Divergência entre schema esperado e banco real

**Fundamento verificado:** o código e o schema Drizzle definem as tabelas `cash_statements`, `cash_reconciliations`, `cash_deposits` e `received_incomes`, mas elas **não existem no banco de produção**. O repositório tem 18 migrations e o banco registra somente 10 aplicadas.

**Impacto direto:** o endpoint legado de upload/conciliação de extratos (`cash.uploadStatement`) falha ao tentar gravar essas tabelas. A importação moderna de proventos por PDF/XLSX continua separada, mas a trilha de “extrato → conciliação de caixa” não está operacionalmente confiável.

**Risco:** crítico. Há tela, router e schema para um fluxo que não possui as tabelas físicas correspondentes.

**Correção proposta:**
1. gerar backup lógico/consulta de inventário antes de qualquer DDL;
2. comparar migrations pendentes com o banco;
3. aplicar exclusivamente as migrations faltantes, em ambiente publicado, por procedimento controlado;
4. incluir teste de saúde que valide tabelas essenciais na inicialização/deploy;
5. só então reativar upload de extrato pelo fluxo de caixa.

---

### C3. A rotina genérica de transações pode desfazer posições reconciliadas

**Fundamento verificado:** há **58 ativos** cuja posição atual diverge da soma das transações existentes. Isso não significa erro de mercado por si só: boa parte é consequência de importações históricas incompletas, conciliações manuais, títulos de renda fixa com unidade não financeira e posições iniciais já cadastradas.

O problema é que `recalculateAsset` considera que toda posição deve ser reconstruída a partir de transações, usando uma semântica única de `quantity × unitPrice`. Depois de incluir ou excluir uma transação, essa função recalcula quantidade e custo do ativo.

**Exemplos verificados de divergência estrutural:**
- renda fixa: existem títulos com `quantity = 1` na posição e transação registrada com quantidade monetária, como o CDB XP;
- cripto e posições antigas: ativos sem transação histórica ou com histórico parcial;
- renda variável: várias posições foram conciliadas diretamente contra a planilha, sem que todo o histórico antigo tenha sido reconstruído.

**Risco:** crítico. Uma compra/venda manual posterior pode recalcular um ativo a partir de um histórico incompleto e sobrescrever a quantidade/custo que foi corretamente conciliada no cadastro atual.

**Correção proposta:** separar formalmente dois regimes:

| Regime | Uso | Comportamento correto |
|---|---|---|
| **Posição reconciliada** | posição-base confirmada por planilha/extrato | transações novas entram como ajuste incremental; nunca reconstruir o passado sem reconciliação completa |
| **Ledger completo** | ativo com todas as compras, vendas, taxas e eventos desde a origem | posição pode ser recalculada exclusivamente a partir do ledger |

A implementação deve armazenar a origem/estado da posição, impedir `recalculateAsset` genérico para renda fixa e posição reconciliada, e oferecer uma ação explícita de “reconstruir pelo ledger” somente após prévia e confirmação.

---

### C4. Exclusões têm risco de integridade e de escopo de usuário

**Fundamento verificado:**
- `deleteAsset` remove transações apenas por `assetId`, sem filtrar `userId` antes de remover o ativo;
- a rota de exclusão não verifica previamente se o ativo pertence ao usuário antes da primeira exclusão;
- `deleteTransaction` recebe `assetId` informado pelo cliente, busca a transação, mas não usa o ativo efetivamente vinculado à transação; em seguida recalcula o `assetId` enviado.

**Risco:** crítico em ambiente multiusuário e relevante mesmo em uso individual. Um identificador incorreto pode levar a recálculo de outro ativo; sem chaves estrangeiras, exclusões também podem deixar proventos, alertas ou eventos sem ativo associado.

**Correção proposta:**
1. buscar o ativo/transação pelo `userId` e derivar o `assetId` somente do registro recuperado;
2. tornar exclusões atômicas com transação de banco;
3. aplicar filtro de usuário em todos os deletes;
4. bloquear exclusão física de ativo com histórico: preferir **arquivamento** (posição zero/inativo) e preservar auditoria;
5. adicionar testes de autorização e de não regressão para `deleteAsset` e `deleteTransaction`.

---

## 3. Achados altos — corrigir no próximo ciclo

### A1. Caixa mistura saldo manual, movimentos imediatos e datas futuras

A arquitetura atual combina:

- `setBalance`: substitui o saldo manualmente;
- `addMovement`: altera o saldo imediatamente;
- transações de ativos: por política, **não** alteram caixa automaticamente;
- scripts de conciliação: podem registrar movimentos associados às operações.

Esse desenho é compreensível quando o extrato é a fonte de verdade, porém os três mecanismos coexistem sem uma regra única de liquidação.

**Evidência objetiva:** há uma saída de `R$ 3.598,54` datada de **13/10/2026** já registrada no caixa em 09/10/2026 (compra de Tesouro Selic com débito futuro). A rotina aplica o efeito ao saldo na criação, não na data de liquidação.

**Risco:** o “caixa disponível hoje” pode incorporar débitos ou créditos futuros. Isso prejudica decisões de aporte e a reconciliação com a conta investimento.

**Simplificação recomendada:**

- adotar `cash_balance` como **saldo conciliado no extrato**, não como saldo derivado de cada movimento;
- manter `cash_movements` como ledger de apoio, com status `previsto`, `liquidado`, `cancelado`;
- apresentar dois números: **saldo disponível** e **saldo projetado após liquidações pendentes**;
- só alterar o saldo disponível quando o evento estiver liquidado ou vier do extrato;
- vincular cada movimentação à sua fonte (`manual`, `extrato`, `operação`, `importação`).

---

### A2. Importação CSV não possui prévia segura e deduplicação é frágil

O modal de CSV mostra somente as três primeiras linhas e oferece importação direta. No servidor, a deduplicação verifica apenas se existe alguma transação na mesma data, o que pode:

- ignorar operações legítimas ocorridas no mesmo dia;
- não identificar duplicidade quando as datas chegam com horário distinto;
- criar ativo automaticamente com base em CSV sem revisão de classe, moeda ou nome;
- recalcular posição usando ponto flutuante e sem transação atômica por lote.

**Risco:** alto para importação de notas com múltiplas operações no mesmo pregão.

**Simplificação recomendada:** unificar CSV, PDF e XLSX em um único assistente:

1. upload/parse;
2. normalização e hash do arquivo;
3. prévia por operação, com alerta de ativo novo e possível duplicidade;
4. aprovação explícita;
5. gravação atômica;
6. relatório de importação e opção de desfazer o lote.

A chave de deduplicação deve considerar fonte, ativo, tipo, data de negociação, quantidade, preço, taxas e identificador de ordem/nota quando disponível — nunca apenas a data.

---

### A3. Importação de proventos precisa de fonte e deduplicação mais robustas

A importação moderna já tem uma prévia selecionável, o que é positivo. Contudo, a comparação de duplicidade confronta a **data-existente de ex** com a **data de pagamento** do arquivo. Se um provento manual tiver data-ex diferente da data de pagamento, ele pode ser reimportado.

Além disso, não há hash do arquivo nem identificador de origem persistido em coluna estruturada; a auditoria depende de texto nas observações.

**Correção recomendada:** persistir `sourceType`, `sourceFileHash`, `sourceLineId` e `importBatchId`; usar data de pagamento quando disponível e data-ex como atributo distinto; criar índice lógico de unicidade por ativo, tipo, valor, data de pagamento e fonte.

---

### A4. Calendário não representa a agenda de carteira atual

Há somente dois eventos, ambos de BRAV3 em junho de 2026 e ainda marcados como agendados. O método `getUpcomingEvents` não filtra intervalo futuro, apesar de calcular `now` e `futureDate`; por isso pode devolver eventos passados. `getEventsByMonth` traz todos os eventos e filtra em memória.

**Risco:** médio/alto. A tela pode induzir o usuário a acreditar que há agenda ativa sem haver monitoramento real.

**Correção proposta:**
- buscar eventos no SQL por intervalo de data e status;
- encerrar/cancelar automaticamente ou sinalizar eventos vencidos;
- criar índice `(userId, eventDate, status)`;
- diferenciar evento confirmado de estimado;
- só exibir “próximos eventos” se a base estiver atualizada.

---

### A5. Cotações e moeda são tratadas de forma inconsistente em telas auxiliares

O cartão principal usa `asset.currency`, que é adequado. Porém, `getReturnHistory` e `getCurrencyBreakdown` classificam ativos USD por **classe**, não pela moeda do próprio ativo. Isso afeta ativos atípicos, como cripto em BRL (ex.: BNB), que pode ser convertido novamente como se fosse USD nessas telas.

Também o refresh tenta cotar classes manuais, como fundos e renda fixa, embora essas posições devam manter marcação manual.

**Correção proposta:**
- usar `asset.currency` como fonte única de conversão em todos os serviços;
- excluir `fundos` e `renda_fixa` do refresh externo e exibir somente status de preço manual;
- guardar fonte da cotação e data-base de forma uniforme;
- manter fallbacks de FTT/AURY/ELET3 com identificação explícita de preço manual ou cotação indisponível.

---

## 4. Melhorias de arquitetura e simplificação

### 4.1. Fonte de verdade por domínio

| Domínio | Fonte de verdade recomendada | O que eliminar/evitar |
|---|---|---|
| Posição atual | `assets` reconciliado + ajustes posteriores | recalcular todo ativo com histórico incompleto |
| Histórico de operações | `transactions` com origem e lote de importação | inserções sem prévia ou sem vínculo de fonte |
| Caixa disponível | último saldo liquidado de extrato/conta | antecipar no saldo débitos futuros |
| Caixa projetado | movimentos pendentes/liquidação futura | misturar com saldo disponível |
| Proventos | `dividends` com fonte estruturada | duplicar por aproximação de datas |
| Renda fixa/fundos | preço manual com data-base | refresh automático externo |
| Patrimônio consolidado | assets + caixa com política cambial explícita | câmbio-base sem status visual |
| Rentabilidade | snapshots diários validados | reconstrução retroativa como regra padrão |

### 4.2. Integridade de banco e performance

O schema não declara índices para buscas frequentes por `userId`, `assetId`, data e status. Consultas atuais funcionam com o volume presente, mas tenderão a se degradar.

Prioridade de índices/constraints:

1. `assets (userId, ticker)` único;
2. `transactions (userId, assetId, transactionDate)`;
3. `dividends (userId, assetId, paymentDate)`;
4. `events (userId, eventDate, status)`;
5. `cash_movements (userId, date)`;
6. chaves estrangeiras, quando suportadas pelo ambiente, ou validação transacional equivalente;
7. índice/identificador de importação para operações e proventos.

### 4.3. Precisão financeira

O banco usa `DECIMAL`, o que é correto. Entretanto, algumas rotinas calculam com `parseFloat`/`number`. Para valores agregados e cálculo de custo médio, a regra deve ser:

- persistência: `DECIMAL`;
- cálculo sensível: decimal.js/big.js ou valores inteiros em centavos/unidades escaladas;
- conversão para `number`: apenas para apresentação/chart;
- arredondamento: definido por domínio (centavo, oito casas para quantidade, preço de título).

### 4.4. Testes que faltam

A suíte existente é saudável, porém concentra-se em funções e validações de UI. Faltam testes de integração para:

- migração/schema real versus Drizzle;
- autorização de exclusões cruzadas entre usuários;
- caixa com liquidação futura;
- importação CSV com duas operações no mesmo dia;
- deduplicação de proventos com data-ex diferente da data de pagamento;
- títulos de renda fixa tratados pela rotina de recálculo;
- job Heartbeat autenticado e persistência de snapshot;
- cálculo de moeda por `asset.currency` em todas as telas.

---

## 5. Plano priorizado de estabilização

| Prioridade | Ação | Benefício | Dados financeiros |
|---|---|---|---|
| **P0** | Corrigir autenticação dos Heartbeats e validar uma execução em produção | volta a registrar snapshots e atualizar notícias | não altera posições |
| **P0** | Resolver migrations pendentes e criar health-check de schema | elimina rotas de extrato quebradas | não altera registros existentes |
| **P0** | Blindar exclusões, escopo de usuário e recálculo por ativo | evita corrupção de posição/histórico | alteração apenas de código/testes |
| **P1** | Criar política “posição reconciliada” versus “ledger completo” | impede que compras novas desfaçam conciliação | requer prévia antes de migrar dados |
| **P1** | Separar caixa disponível de caixa projetado | torna saldo operacional confiável | exige marcar movimentos pendentes/liquidados |
| **P1** | Unificar importações com prévia, lote e desfazer | reduz duplicidade e criação indevida | novas importações passam a ser auditáveis |
| **P2** | Corrigir calendário, índices e moeda por ativo | melhora agenda, performance e consistência analítica | sem mudança de patrimônio |
| **P2** | Retirar/gatear `seedPortfolio` legado | reduz risco de criação de ativos sem validação | não altera dados existentes |

---

## 6. Decisões estratégicas recomendadas antes de implementar

1. **Caixa:** confirmar se o saldo oficial deve ser o último saldo do extrato (recomendado) ou um ledger integral de movimentos. A primeira opção é mais simples e aderente ao uso atual.
2. **Posições antigas:** adotar o cadastro reconciliado como base até que o histórico completo esteja disponível; não forçar reconstrução automática por transações parciais.
3. **Câmbio-base:** mantê-lo como “marca de conciliação” identificada na tela ou retornar ao câmbio de mercado. A troca deve ser uma ação explícita, nunca implícita.
4. **Automação:** corrigir e manter apenas um snapshot diário; o refresh de notícias pode permanecer em meia hora depois de autenticado, mas com limite/telemetria.

---

## 7. Limitações da auditoria

- Não foram alteradas posições, preços, caixa, proventos ou transações.
- Divergência entre posição e transações **não foi tratada como erro automático**, pois parte dela decorre de conciliações aprovadas e de histórico incompleto.
- Não foi disparado job nem executado endpoint de produção, pois isso criaria snapshots/notícias e seria uma ação operacional. Foram examinados apenas os logs existentes.
- A auditoria não substitui conciliação bancária ou fiscal formal; ela identifica consistência de sistema e fluxo de dados.
