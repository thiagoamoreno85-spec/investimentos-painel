# Plano de melhorias de layout e funcionalidades

**Painel:** ManusInvest — Carteira de Investimentos  
**Data da auditoria:** 21/10/2026  
**Escopo:** layout desktop/mobile, navegação, operações financeiras, dados de mercado, importações, notícias, alertas, patrimônio e projeções.  
**Método:** leitura do código, revisão das telas principais em desktop e mobile, testes existentes e inspeção dos fluxos de persistência. Nenhum dado financeiro foi alterado nesta auditoria.

## Síntese executiva

O painel tem boa cobertura funcional para acompanhar carteira, proventos, mercado, notícias, alertas e análises. A maior oportunidade não é incluir mais módulos imediatamente, mas consolidar a base operacional: autorização por usuário, atomicidade das movimentações financeiras, moedas/datas corretas, origem dos dados e uma hierarquia visual mais simples.

A recomendação é executar as melhorias em fases curtas. Primeiro, corrigir riscos de integridade e clareza financeira; depois, simplificar a experiência móvel e a navegação; por fim, evoluir automação e análises. Essa ordem reduz o risco de ampliar funcionalidades sobre dados que ainda podem gerar resultados enganosos.

## Prioridade 0 — integridade, segurança e confiabilidade financeira

| Tema | Achado | Melhoria recomendada | Critério de aceite |
|---|---|---|---|
| Autorização patrimonial | Em pagamentos e baixas de passivos, a validação de propriedade deve ocorrer antes da escrita e sempre usar `id + userId`. | Tornar pagamento e baixa uma única transação de banco; impedir pagamento acima do saldo restante. | Nenhuma escrita ocorre para registro de outro usuário; não há pagamento órfão nem saldo negativo. |
| Exclusão de ativo | A exclusão precisa confirmar a propriedade antes de apagar eventos dependentes. | Usar transação, filtro por usuário em todas as exclusões e decisão explícita para proventos/alertas/eventos vinculados. | Exclusão não pode afetar dados de terceiros e exibe os efeitos antes de confirmar. |
| Operações e CSV | Compra/venda, criação implícita de ativo e importação podem deixar alterações parciais ou bloquear operações legítimas do mesmo dia. | Pré-validar lote completo, usar chave de idempotência por operação e gravar/recalcular dentro de uma única transação. | Venda acima da posição não grava nada; reimportação não duplica; duas operações válidas no mesmo dia são aceitas. |
| Moeda e datas | Proventos e históricos podem misturar BRL e USD; há uso de datas de pagamento/ex sem distinção clara. | Guardar moeda e data de pagamento separadamente; mostrar subtotal por moeda ou FX datado/metodologia explícita. | Nenhum total em R$ soma valores em US$ sem conversão verificável. |
| Benchmark de carteira | Série de retorno interpolada pode parecer histórico real. | Calcular retorno por snapshots e fluxos, ou identificar a série como estimativa e limitar a visualização. | Todo gráfico deixa claro se é observado, reconstruído ou estimado. |
| Melhor Compra | A análise é apresentada como fundamentalista, mas não recebe balanços/múltiplos; moeda internacional pode ser tratada incorretamente. | Corrigir conversão cambial e cache; renomear para triagem quantitativa assistida até incorporar dados fundamentalistas reais. | Resultado mostra moeda, FX, fonte/data da cotação, idade do dado e metodologia. |

## Prioridade 1 — simplificação e experiência de uso

### Navegação e hierarquia

- Padronizar a taxonomia em português: **Carteira financeira**, **Patrimônio não financeiro**, **Passivos** e **Patrimônio líquido consolidado**. Remover a alternância com “Net Worth” e abreviações ambíguas.
- Reorganizar a Visão Geral em três blocos: **Hoje** (resultado, alertas e agenda), **Carteira** (alocação e posições) e **Evolução** (histórico, benchmarks e exposição cambial).
- No mobile, usar topbar em grade com menu, título da página e ações; consolidar alertas/notícias em um único ponto de notificações.

### Tabelas, filtros e mobile

- Aplicar nas telas **Transações** e **Proventos** o mesmo padrão já usado na Alocação: resumo móvel com métricas prioritárias, detalhe expansível e tabela integral apenas em telas maiores.
- Em Dashboard de Mercado, substituir os diversos botões de ordenação por um único controle “Ordenar por” com métrica e direção. Manter chips somente para a classe do ativo.
- Na Alocação, reduzir áreas aninhadas de rolagem. A página deve manter um único fluxo principal ou um único painel rolável claramente delimitado.
- No Calendário, exibir agenda cronológica no mobile em vez de comprimir a grade mensal de sete colunas.

### Notícias, alertas e interações

- Unificar a fonte e a lógica das notícias da central de Notícias e da aba de Mercado. A aba de Mercado deve ser um resumo do mesmo repositório, não uma segunda classificação independente.
- Deduplicar notícias por URL canônica/título/data de publicação e evitar alertas repetidos gerados pela mesma notícia.
- Separar ações de “abrir/expandir” e “marcar como lida”; cartões clicáveis devem ter interação por teclado e botões semânticos.
- Exigir confirmação contextual ou ação de desfazer para exclusões de transações, proventos, alertas, ativos e passivos.

## Prioridade 2 — qualidade de dados e automação

- Em qualquer valor de mercado, exibir **fonte, moeda, horário/data-base e status**: ao vivo, cache, manual, fallback ou indisponível.
- Usar consultas separadas para **posições abertas** e **catálogo histórico de ativos**, preservando nome/ticker em transações e proventos de ativos zerados.
- Criar índice único e normalização de `userId + ticker`; oferecer mesclagem assistida quando encontrar duplicidade preexistente.
- Fazer os alertas atualizarem cotações antes da verificação, exigir preço-alvo no servidor e só usar a expressão “automático” se o agendamento/notificação estiver ativo.
- Integrar a Rentabilidade Detalhada à página principal com um CTA de auditoria diária e legenda para dados de fechamento, reconstruídos e intradiários.
- Ligar Aportes ao consolidado real ou rotular claramente o recurso como simulador genérico, com cenários real/nominal/conservador e aviso de limitações.

## Prioridade 3 — acabamento, acessibilidade e consistência

- Transformar o modo de privacidade em ocultação real (`••••`), não apenas desfoque; remover conteúdo sensível da árvore de acessibilidade quando ativo.
- Garantir `aria-label`, foco visível e texto de apoio para botões de ícone e ações de exclusão.
- Estabelecer tamanho mínimo de 12 px para informação operacional e 14 px para ações em mobile; evitar `text-[9px]` e `text-[10px]` em dados importantes.
- Acrescentar resumo textual e tabela/legenda navegável aos gráficos; cor deve reforçar, não ser a única forma de indicar alta/queda.
- Criar componentes compartilhados para badges, status de fonte, confirmação de exclusão, paginação, formatação monetária e tabela histórica.

## Roteiro recomendado de execução

1. **Sprint 1 — Segurança e dados financeiros:** autorização, transações atômicas, idempotência de importação, moeda/data de proventos e exclusões protegidas.
2. **Sprint 2 — Verdade e rastreabilidade:** fonte/data de valores, histórico de ativos zerados, retorno real por snapshots e ajuste da ferramenta Melhor Compra.
3. **Sprint 3 — UX operacional:** tabelas móveis, navegação, taxonomia, Dashboard de Mercado, Notícias e Calendário.
4. **Sprint 4 — Automação e acabamento:** alertas agendados, deduplicação de notícias, integração do calendário, acessibilidade e componentes compartilhados.

---

# Prompt pronto para implementação

```text
Atue como engenheiro full-stack sênior e designer de produto para o projeto “investimentos-painel”, em /home/ubuntu/investimentos-painel.

OBJETIVO
Evoluir o painel de investimentos com prioridade absoluta para integridade financeira, segurança multiusuário, rastreabilidade dos dados e uma experiência mobile clara. Não transforme o projeto em um redesenho genérico: preserve o tema dark, o modo de privacidade, o idioma pt-BR e os padrões visuais já consolidados.

REGRAS INEGOCIÁVEIS
1. Nunca criar, semear, apagar ou alterar ativos, patrimônio, caixa, transações, proventos, posições, preços manuais ou movimentações financeiras sem autorização explícita do usuário para cada gravação financeira.
2. Para importações: extrair → deduplicar → apresentar prévia → pedir confirmação → gravar somente o aprovado.
3. Não executar ordens, pagamentos ou operações de mercado.
4. Nunca apresentar estimativa, interpolação ou dado de IA como fato observado. Identificar claramente fonte, moeda, data-base, método e limitações.
5. Toda mutação financeira deve ser transacional, idempotente quando aplicável e filtrada por `userId`.
6. Manter TypeScript strict. Depois de cada fase, executar `npx tsc --noEmit`, `pnpm test`, `git diff --check` e validação visual desktop/mobile.
7. Atualizar `todo.md` antes de iniciar cada fase, criar testes de regressão e salvar checkpoint ao fim de cada fase.

FASE 1 — INTEGRIDADE E AUTORIZAÇÃO (P0)
A. Patrimônio e passivos
- Em `patrimonial.registerPayment`, validar propriedade e saldo restante antes da escrita.
- Usar uma única transação para inserir pagamento e atualizar o passivo.
- Filtrar toda atualização/exclusão por `id + userId`.
- Impedir pagamento acima do saldo; retornar erro claro ao cliente.

B. Ativos e transações
- Corrigir `deleteAsset` para verificar propriedade antes de afetar transações ou dependências.
- Implementar exclusão lógica/auditável ou, se a exclusão física for mantida, mostrar dependências e exigir confirmação explícita.
- Em compra/venda, pré-validar quantidade, custo e posição conciliada; gravar evento e recalcular posição na mesma transação.
- Não deixar ativo ou transação parcial se o recálculo falhar.

C. Importações
- Substituir deduplicação simplista de CSV por chave idempotente: corretora/nota/linha quando disponível; fallback por hash de data + ativo + tipo + quantidade + preço + taxa + moeda.
- Validar o lote inteiro antes de escrever. Aceitar várias operações legítimas em uma mesma data.
- Reutilizar o mesmo motor de posição conciliada/custo médio das operações manuais.

D. Testes obrigatórios
- Teste de isolamento entre usuários.
- Teste de venda acima da posição sem escrita parcial.
- Teste de duas operações diferentes no mesmo dia.
- Teste de reimportação idempotente.
- Teste de pagamento de passivo acima do saldo e para passivo de outro usuário.

FASE 2 — VERDADE DOS DADOS E METODOLOGIA (P0/P1)
A. Moedas e proventos
- Preservar moeda original, data-com e data de pagamento em campos distintos.
- Não somar BRL e USD em um único total sem conversão FX datada e identificada.
- Mostrar subtotais por moeda quando não houver FX histórico confiável.

B. Carteira, preços e histórico
- Separar consultas de posições abertas e catálogo/histórico de ativos zerados.
- Exibir em todos os valores de mercado: fonte, moeda, data/hora, estado ao vivo/cache/manual/fallback e data-base de preço manual.
- Criar índice único normalizado por `userId + ticker`; diagnosticar duplicidades existentes antes de qualquer mesclagem.

C. Rentabilidade e benchmarks
- Não apresentar retorno interpolado como histórico real.
- Construir retorno a partir de snapshots e fluxos externos quando os dados permitirem; caso contrário, rotular como estimativa e exibir cobertura temporal.
- Expor CTA “Ver auditoria diária” na tela de Rentabilidade.

D. Melhor Compra
- Corrigir a conversão de BRL para ativos USD/cripto e a chave de cache, incluindo valor disponível, foco, contexto e versão dos dados.
- Renomear temporariamente o módulo para “Triagem quantitativa assistida por IA” até que fundamentos reais sejam integrados.
- Exibir fonte, idade, moeda e data-base da cotação; bloquear recomendação quantitativa quando o preço for inválido.

FASE 3 — UX OPERACIONAL E MOBILE (P1)
A. Informação e navegação
- Padronizar nomes em pt-BR: Carteira financeira, Patrimônio não financeiro, Passivos, Patrimônio líquido consolidado.
- Reestruturar a Home em Hoje, Carteira e Evolução, mantendo links para detalhes.
- Em mobile, usar topbar em três zonas: menu, título da página e ações; manter apenas um centro de notificações com contadores.

B. Tabelas e filtros
- Aplicar padrão de cards móveis expansíveis em Transações e Proventos; tabela completa apenas em `md+` e rolagem horizontal explícita como fallback.
- Em Dashboard de Mercado, trocar múltiplos botões de ordenação por um controle “Ordenar por” com métrica e direção.
- Simplificar a Alocação para uma única região de rolagem claramente definida.
- No Calendário, renderizar agenda cronológica no mobile; manter grade mensal em telas maiores.

C. Notícias, alertas e exclusões
- Unificar a central de Notícias e a aba de Mercado em um único repositório/pipeline de priorização.
- Deduplicar notícias por URL canônica/título/data e alertas derivados por notícia.
- Separar abrir, marcar como lida e navegar à fonte em ações semânticas e acessíveis.
- Aplicar confirmação contextual ou “desfazer” nas exclusões financeiras e patrimoniais.

FASE 4 — AUTOMAÇÃO, ACESSIBILIDADE E CONSISTÊNCIA (P2)
- Implementar status consistente de atualização de dados e agendamentos.
- Exibir alertas de preço com cotação atualizada e exigir alvo no backend.
- Criar privacy mask real que não deixe valores sensíveis legíveis no DOM/árvore de acessibilidade quando ocultos.
- Padronizar badges, status, ícones Lucide, labels e formatação monetária.
- Incluir alternativas textuais para gráficos e não depender apenas de cor/tooltips.
- Garantir tamanho mínimo de 12 px para dados operacionais e 14 px para ações em mobile.

FORMA DE EXECUÇÃO
- Trabalhe por fase; não inicie a fase seguinte se os testes/validações da fase atual falharem.
- Não altere dados financeiros existentes durante as fases técnicas.
- Ao final de cada fase, entregue: resumo de mudanças, testes realizados, riscos remanescentes, arquivos principais alterados e checkpoint salvo.
- Se qualquer melhoria depender de uma decisão financeira, importação ou mudança de dado real, pare e solicite confirmação explícita.
```

## Limitações e observações

A análise identificou também falhas conhecidas de cotação para alguns símbolos. Elas devem ser tratadas como estado de fonte indisponível, e não “corrigidas” automaticamente por criação de dados. O fluxo B3/EWZ deve continuar apresentado como duas séries distintas: o EWZ é indicador offshore e não deve ser somado ao fluxo de investidor estrangeiro da B3.
