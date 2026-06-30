# Project TODO

- [x] Basic homepage layout (Visão Geral)
- [x] Dashboard Layout com sidebar
- [x] Página de Alocação por classe
- [x] Página de Rentabilidade com gráficos
- [x] Página de Simulador de Aportes
- [x] Tema Manus Dark aplicado
- [x] Dados estáticos da carteira
- [x] Upgrade para full-stack (web-db-user)
- [x] Resolver conflitos do upgrade e restaurar páginas
- [x] Schema de banco de dados para ativos e transações
- [x] API backend (tRPC) para CRUD de ativos e transações
- [x] Cálculo automático de preço médio ponderado
- [x] API de cotações em tempo real via backend (Yahoo Finance)
- [x] Página de registro de compras/vendas (Transações)
- [x] Integrar dados do banco nas páginas existentes (Home, Alocação, Rentabilidade)
- [x] Fallback para dados estáticos quando banco vazio
- [x] Botão de importação da carteira completa (seed)
- [x] Botão de atualização de cotações em tempo real
- [x] Menu mobile responsivo com hamburger
- [x] Cotação USD/BRL para conversão de ativos internacionais
- [x] Testes vitest (11 testes passando)
- [x] Logout funcional no sidebar
- [x] Schema de banco para dividendos (tabela dividends)
- [x] Schema de banco para alertas (tabela alerts)
- [x] tRPC router para dividendos (CRUD + Yield on Cost)
- [x] tRPC router para alertas (CRUD + verificação automática)
- [x] Página de Dividendos com formulário e resumo por ativo
- [x] Página de Alertas com lista e badge de notificação
- [x] Badge de alertas disparados no sidebar
- [x] Testes vitest para dividendos e alertas (15 novos testes, 26 total)
- [x] Página "Melhor Compra do Dia" com campo de valor e análise por IA
- [x] Router tRPC para análise de melhor compra com LLM
- [x] Integrar cotações em tempo real na análise de IA
- [x] Integrar no menu lateral com destaque dourado
- [x] Tabela analysisHistory no schema do banco
- [x] Salvar cada análise gerada no banco automaticamente
- [x] Procedure tRPC para listar histórico com paginação
- [x] Procedure tRPC para deletar análise do histórico
- [x] Painel de histórico na página Melhor Compra com filtros
- [x] Visualização completa de análise passada em modal/expansão
- [x] Router tRPC para índices globais (Ibovespa, S&P500, Nasdaq, Dólar, Euro, Ouro, Petróleo)
- [x] Router tRPC para taxas DI/Selic/IPCA via API do Banco Central
- [x] Router tRPC para notícias sobre ativos da carteira
- [x] Página Dashboard de Mercado com módulo de índices
- [x] Módulo de taxas macro (DI, Selic, IPCA, Juro Real)
- [x] Módulo de notícias filtradas por ativos da carteira
- [x] Módulo de calendário de resultados/eventos com visualização mensal
- [x] Integrar Dashboard de Mercado no menu lateral
- [x] Página de Notícias dedicada com cards horizontais estilo TradersClub
- [x] Backend: procedure tRPC para buscar e analisar notícias via LLM com impacto por ativo
- [x] Cards de notícias com badges dos ativos impactados, link para fonte original
- [x] Avaliação de impacto: Alto (vermelho) / Médio (amarelo) / Baixo (verde)
- [x] Filtros: Todas / Brasil / Global / Cripto / Urgentes
- [x] Painel lateral: Sentimento por setor e ativos mais citados
- [x] Integração automática: notícia de impacto Alto dispara alerta na tela de Alertas
- [x] Atualização automática de notícias a cada 30 minutos (Heartbeat cron: mo73QzPooGL6nY47EsXaer)
- [x] Integrar Notícias no menu lateral do dashboard
- [x] Tabela newsItems no schema do banco
- [x] Tipo news_alert adicionado ao enum de alertas
- [x] 18 novos testes vitest para módulo de notícias
- [x] 12 novos testes vitest para handler de cron e refresh service (83 total)

## Previsão Direcional de Preço (Sprint atual)
- [x] Adicionar coluna priceDirection ao schema newsItems (alta_forte, alta_media, alta_fraca, baixa_fraca, baixa_media, baixa_forte, neutro)
- [x] Migrar banco de dados com pnpm db:push
- [x] Atualizar newsRefreshService: incluir priceDirection no prompt LLM e no JSON schema
- [x] Atualizar db.ts helpers para incluir priceDirection
- [x] Atualizar cards de notícias com badge direcional (seta + cor + label)
- [x] Incluir priceDirection na mensagem de alerta gerado automaticamente
- [x] Atualizar tela de Alertas para exibir direção do preço nos alertas news_alert
- [x] Testes vitest para priceDirection (7 novos testes, 90 total)

## Adaptação Mobile (Sprint atual)
- [x] DashboardLayout: topbar mobile com botão hambúrguer, sidebar colapsável com overlay
- [x] DashboardLayout: fechar sidebar ao clicar em item do menu no mobile
- [x] Visão Geral: cards em grid 2x2 no mobile, gráficos responsivos
- [x] Alocação: tabela com scroll horizontal no mobile, tabs compactas
- [x] Rentabilidade: gráficos responsivos, cards empilhados no mobile
- [x] Transações: formulário e tabela responsivos no mobile
- [x] Dividendos: gráfico e tabela YoC responsivos no mobile
- [x] Alertas: formulário e lista responsivos no mobile
- [x] Notícias: cards verticais no mobile, painel lateral abaixo
- [x] Aportes: formulário e tabela responsivos no mobile
- [x] Melhor Compra: layout responsivo no mobile
- [x] Dashboard Mercado: tabs compactas e grid responsivo no mobile

## Calendário de Eventos (Sprint atual - Correções)
- [x] Corrigir EventCalendar para renderizar calendário mensal real (offset do primeiro dia, células vazias, alinhamento, grade completa 6x7)
- [x] Implementar getEventsByMonth no backend com filtro real por mês/ano
- [x] Usar getEventsByMonth no frontend para carregar apenas eventos do mês
- [x] Adicionar estados de loading, erro e vazio no calendário
- [x] Adicionar testes Vitest para CRUD de eventos (5+ testes)
- [x] Zerar valor de caixa hardcoded

## Controle de Caixa (Sprint atual)
- [x] Tabelas cash_balance e cash_movements no schema
- [x] Migração do banco com pnpm db:push
- [x] Router cash.ts com procedures: getBalance, setBalance, addMovement, listMovements, deleteMovement
- [x] Registrar cashRouter no appRouter
- [x] Componente CaixaCard com saldo dinâmico, formulário de movimentação e histórico
- [x] Substituir card estático de Caixa pelo CaixaCard dinâmico na Home

## Correção Aba Caixa em Alocação (Sprint atual)
- [x] Remover ativos estáticos de caixa do banco (ids 84 e 85)
- [x] Reescrever Alocacao.tsx com queries trpc.cash.getBalance e trpc.cash.listMovements
- [x] Renderização especial para aba Caixa: card de saldo + tabela de movimentações
- [x] Ignorar ativos de classe 'caixa' do dbAssets (evitar duplicação)
- [x] Incluir cashBalance no totalPatrimony e pieData em Alocacao.tsx
- [x] Corrigir Home.tsx: adicionar trpc.cash.getBalance, incluir cashBalance no patrimônio e pieData
- [x] Corrigir Home.tsx: ignorar ativos de classe 'caixa' do dbAssets (evitar duplicação)
- [x] Build sem erros TypeScript (pnpm build ✅)
- [x] 90 testes vitest passando


## Integração Automática Transações ↔ Caixa (Sprint atual - CONCLUÍDO)
- [x] Modificar procedure addTransaction em portfolio.ts para debitar/creditar caixa automaticamente
- [x] Ao registrar COMPRA: debita cash_balance com valor total (qtd × preço + taxas)
- [x] Ao registrar VENDA: credita cash_balance com valor total (qtd × preço + taxas)
- [x] Registrar movimentação automática em cash_movements com tipo "compra_ativo" ou "resgate"
- [x] Modificar procedure deleteTransaction para reverter saldo do caixa automaticamente
- [x] Build sem erros TypeScript (pnpm build ✅)
- [x] 90 testes vitest passando

## Importação Automática de Dividendos via PDF XP (Sprint atual - CONCLUÍDO)
- [x] Criar parser XP PDF (pdfDividendParser.ts) com extração de seção Proventos
- [x] Mapear tipos de proventos (JURO/JCP, DIVI/Dividendo, etc)
- [x] Adicionar procedure previewDividendsFromPDF em dividends.ts (query)
- [x] Adicionar procedure importDividendsFromPDF em dividends.ts (mutation)
- [x] Deduplicação automática por (ticker, tipo, data)
- [x] Validação de ativos na carteira
- [x] Build sem erros TypeScript (pnpm build ✅)
- [x] 90 testes vitest passando

## 10 Melhorias (promptmanus.md) - CONCLUÍDAS
- [x] Tarefa 1: ESLint - instalar e configurar .eslintrc.cjs + script lint
- [x] Tarefa 2: GitHub Actions CI - criar .github/workflows/ci.yml
- [x] Tarefa 3: Lazy Loading - substituir imports estáticos por lazy() em App.tsx
- [x] Tarefa 4: Paginação - getTransactions e getDividends com page/limit
- [x] Tarefa 5: Rate Limiting - express-rate-limit no server/_core/index.ts
- [x] Tarefa 6: README.md - criar documentação completa
- [x] Tarefa 7: .env.example - criar arquivo de exemplo de variáveis
- [x] Tarefa 8: Skeleton Screens - substituir Loader2 por skeletons nas páginas
- [x] Tarefa 9: Constantes Centralizadas - criar shared/constants.ts
- [x] Tarefa 10: ProtectedRoute - componente de autenticação guard

## Rentabilidade Diária e Mensal (promptmanusrentabilidade.md) - CONCLUÍDO
- [x] Tarefa 1: Adicionar tabela portfolio_snapshots ao drizzle/schema.ts + pnpm db:push
- [x] Tarefa 2: Criar server/services/snapshotService.ts
- [x] Tarefa 3: Criar server/scheduled/snapshotHandler.ts
- [x] Tarefa 4: Registrar endpoint /api/scheduled/portfolio-snapshot em server/_core/index.ts
- [x] Tarefa 5: Adicionar procedures captureSnapshot, getPerformance, getSnapshotHistory em portfolio.ts
- [x] Tarefa 6: Criar client/src/components/PerformanceCards.tsx
- [x] Tarefa 7: Integrar PerformanceCards em Home.tsx (grid 6 colunas)
- [x] Tarefa 8: Criar server/snapshot.test.ts com 6 testes
- [x] Tarefa 9: Cron Heartbeat requer deploy antes de criar - aguardando publicação

## Correção Dashboard de Mercado (promptmanusmarketfix.md) - CONCLUÍDO
- [x] Corrigir séries BCB em market.ts: usar 1178 (Selic Over), 4389 (CDI anual), 13522 (IPCA 12m), 432 (Meta Selic)
- [x] Adicionar Juro Real calculado (Selic Over - IPCA 12m)
- [x] Corrigir DashboardMercado.tsx: find("Selic (efetiva)") → find("Meta Selic (COPOM)")
- [x] Verificar coloração condicional IPCA (rate.name.includes("IPCA") - OK)
- [x] Confirmar série 4390 CDI benchmark não alterada
- [x] pnpm build sem erros ✅
- [x] 96 testes vitest passando ✅

## Correção Notícias - RSS Real (promptmanusnoticiasfix.md) - CONCLUÍDO
- [x] Testar feeds RSS: 6/7 funcionando (InfoMoney, Folha Mercado, Investing.com BR, Google News BR/Cripto/US)
- [x] Reescrever newsRefreshService.ts: busca RSS real + LLM apenas para análise de impacto
- [x] Links são URLs reais das fontes (InfoMoney, Folha, Google News)
- [x] pnpm build sem erros ✅
- [x] 96 testes vitest passando ✅

## Rentabilidade Diária por Classe (promptmanusrentabilidadediaria.md) - CONCLUÍDO
- [x] Verificar imports fetchQuotes e fetchUsdBrl em portfolio.ts
- [x] Adicionar procedure getDailyPerformance em portfolio.ts
- [x] Criar client/src/components/PerformanceCard.tsx (singular, diferente de PerformanceCards.tsx)
- [x] Integrar PerformanceCard em Home.tsx (substituir card Maior Posição)
- [x] pnpm build sem erros (TypeScript: 0 erros)
- [x] pnpm test todos passando (96 testes ✅)

## Ajuste Mobile — Tabela de Alocação Detalhada (promptmanusalocacaomobile.md) - CONCLUÍDO
- [x] Substituir bloco da tabela padrão em Alocacao.tsx (linhas ~314-375) pela versão compacta mobile
- [x] Coluna Ativo: ticker curto em mobile, nome completo em desktop
- [x] Coluna Total: formato compacto R$74.8k em mobile
- [x] Coluna L/P: apenas percentual em mobile, valor + % em desktop
- [x] Reduzir padding horizontal (px-1 md:px-4) em th e td
- [x] pnpm build sem erros (TypeScript: 0 erros)
- [x] pnpm test todos passando (96 testes ✅)

## Correção Alinhamento de Colunas — Tabela de Alocação (promptmanusalinharcolunas.md) - CONCLUÍDO
- [x] Unificar thead e tbody em uma única <table> em Alocacao.tsx
- [x] Adicionar sticky top-0 z-10 no <thead> para header fixo durante scroll
- [x] Mover <ScrollArea> para envolver a tabela inteira
- [x] Remover <div> separado que encapsulava o <thead>
- [x] Verificar alinhamento perfeito entre títulos e valores
- [x] pnpm build sem erros (built in 23.73s ✅)
- [x] pnpm test todos passando (96 testes ✅)

## Scroll Fixo — Tabela de Alocação (promptmanusalocacaoscrollfixo.md) - CONCLUÍDO
- [x] Linha 195: trocar container de space-y-6 para flex flex-col h-full gap-4
- [x] Linha 251: adicionar pb-2 md:pb-4 ao CardContent
- [x] Linha 329: adicionar max-h-[calc(100vh-320px)] md:max-h-[calc(100vh-280px)] ao container da tabela
- [x] Verificar que título, tabs, header do card e colunas ficam estáticos
- [x] Verificar que apenas ativos rolam
- [x] pnpm build sem erros (built in 23.73s ✅)
- [x] pnpm test todos passando (96 testes ✅)

## Correção Scroll Vertical — Apenas nos Ativos
- [x] Separar <thead> fixo em tabela separada fora do ScrollArea
- [x] ScrollArea envolver apenas <tbody> com ativos
- [x] Scroll vertical apenas nos ativos (de cima para baixo)
- [x] pnpm build sem erros (✅)
- [x] pnpm test todos passando (96 testes ✅)

## Importação de Extrato XP (XLSX) com Deduplicação Automática - CONCLUÍDO
- [x] Criar parser de extrato XLSX (server/lib/xpStatementParser.ts) com extração de proventos
- [x] Lógica de deduplicação: verificar por (userId, assetId, type, totalValue, exDate ±2 dias) antes de inserir
- [x] Procedure previewDividendsFromStatement (mutation) com relatório de novos/duplicados/não encontrados
- [x] Procedure importDividendsFromStatement (mutation) com retorno: importados, ignorados, não encontrados
- [x] UI de upload do extrato XLSX na página de Dividendos (drag-and-drop + clique)
- [x] Preview dos proventos detectados antes de confirmar importação (seleção individual)
- [x] Exibir resultado pós-importação: importados vs já lançados vs não cadastrados
- [x] pnpm build sem erros (built in 21.58s ✅)
- [x] pnpm test todos passando (96 testes ✅)

## Botão Ocultar/Mostrar Saldos Financeiros - CONCLUÍDO (Fase 1 + Fase 2 Completa)
- [x] Criar contexto global BalanceVisibilityContext com hook useBalanceVisibility
- [x] Adicionar botão toggle (olho/olho-riscado) no header da Visão Geral
- [x] Aplicar blur nos valores de: Patrimônio Total, Rentabilidade Total (Fase 1)
- [x] Aplicar blur nos valores de: Rent. Hoje, Caixa (Fase 2)
- [x] Aplicar blur nos valores de: Rent. Hoje breakdown por classe (Fase 2)
- [x] Aplicar blur nos valores das movimentações do Caixa (Fase 2)
- [x] Aplicar blur nos valores de: Rent. Mês + breakdown por classe (Fase 2)
- [x] Aplicar blur nos valores da tabela de Alocação (Qtd, Preço, Total, L/P) (Fase 2)
- [x] Aplicar blur nos valores da tabela de Top 5 Posições (Fase 2)
- [x] Estado persistido em localStorage (showBalances)
- [x] pnpm build sem erros (built in 21.39s ✅)
- [x] pnpm test todos passando (96 testes ✅)
