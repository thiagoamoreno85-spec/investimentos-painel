# ManusInvest — Painel de Investimentos

Dashboard completo para gestão de carteira de investimentos com análise por IA.

## Tech Stack

| Camada | Tecnologias |
|--------|-------------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui (Radix), Recharts, React Hook Form, Zod, Wouter |
| Backend | Express, tRPC 11, Drizzle ORM, MySQL |
| IA | LLM integrado (análise de compra, impacto de notícias) |
| APIs Externas | Yahoo Finance (cotações), Banco Central do Brasil (taxas macro) |

## Features

- **Dashboard**: Visão geral do patrimônio, lucro, alocação por classe
- **Alocação**: Distribuição por classe de ativo e moeda
- **Rentabilidade**: Retorno vs benchmarks (CDI, Ibovespa)
- **Transações**: Compra/venda com import CSV (B3, XP, Rico, Clear) e paginação
- **Dividendos**: Tracking com Yield on Cost, import PDF (XP) e paginação
- **Alertas**: 7 tipos de alerta de preço com monitoramento automático
- **Melhor Compra**: Recomendação de compra por IA com histórico
- **Mercado**: Índices globais, commodities, cripto, taxas macro
- **Notícias**: Feed com análise de impacto por IA e previsão direcional
- **Calendário**: Eventos corporativos (earnings, dividendos, splits)
- **Caixa**: Gestão de saldo com movimentações automáticas (integrado a Transações)

## Pré-requisitos

- Node.js 20+
- pnpm 10+
- MySQL 8+

## Instalação

```bash
git clone <repo-url>
cd investimentos-painel
pnpm install
cp .env.example .env    # configure as variáveis
pnpm db:push            # cria tabelas + migrations
pnpm dev                # inicia em http://localhost:3000
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Servidor de desenvolvimento com HMR |
| `pnpm build` | Build de produção (Vite + esbuild) |
| `pnpm start` | Inicia servidor de produção |
| `pnpm check` | Verifica tipos TypeScript |
| `pnpm lint` | Lint com ESLint |
| `pnpm test` | Testes com Vitest |
| `pnpm format` | Formata código com Prettier |
| `pnpm db:push` | Gera e aplica migrations Drizzle |

## Variáveis de Ambiente

Veja `.env.example` para a lista completa.

## Estrutura do Projeto

```
client/src/          # Frontend React
  pages/             # 13 páginas do dashboard
  components/        # Componentes reutilizáveis + shadcn/ui
  hooks/             # Custom hooks
  contexts/          # ThemeContext
  lib/               # tRPC client, utilitários
server/              # Backend Express + tRPC
  _core/             # Infraestrutura (auth, env, server, rate limiting)
  routers/           # Procedures tRPC (7 routers)
  services/          # Lógica de negócio
  scheduled/         # Jobs agendados (Heartbeat cron)
  lib/               # Parsers CSV/PDF
shared/              # Tipos e constantes compartilhadas
drizzle/             # Schema e migrations MySQL
.github/workflows/   # CI/CD com GitHub Actions
```

## CI/CD

O projeto inclui pipeline de CI via GitHub Actions (`.github/workflows/ci.yml`) que executa em cada push/PR para `main`:

1. Lint (`pnpm lint`)
2. Type check (`pnpm check`)
3. Testes (`pnpm test`)
4. Build (`pnpm build`)

## Segurança

- Rate limiting global: 100 req/min por IP
- Rate limiting APIs externas: 10 req/min
- Rate limiting IA: 5 req/min
- Autenticação via Manus OAuth (JWT + cookies)
- Todas as procedures protegidas por `protectedProcedure`
