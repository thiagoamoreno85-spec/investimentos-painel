# ManusInvest Design System — 2026

Redesign dark-first, finance-grade. Tokens definidos em `client/src/index.css`, consumidos via Tailwind 4 (`@theme inline`).

## Paleta de Cores (OKLCH)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `oklch(0.145 0.014 261)` | Fundo — azul-carvão profundo |
| `--card` | `oklch(0.185 0.014 261)` | Superfícies elevadas |
| `--sidebar` | `oklch(0.165 0.014 261)` | Sidebar (meio-tom entre fundo e card) |
| `--primary` | `oklch(0.72 0.14 250)` | Azure/índigo — ações, navegação ativa, links |
| `--success` | `oklch(0.72 0.15 160)` | Esmeralda — ganho, entrada |
| `--destructive` | `oklch(0.60 0.21 25)` | Vermelho — perda, saída |
| `--warning` | `oklch(0.80 0.15 80)` | Âmbar — alertas, destaque ("Melhor Compra") |
| `--border` | `oklch(0.27 0.012 261)` | Bordas e divisores |
| `--muted-foreground` | `oklch(0.66 0.012 255)` | Texto secundário (contraste AA+ sobre card) |

**Racional:** o neutro azulado (hue 261) substitui o cinza quente anterior — lê-se como "terminal financeiro" moderno (Linear/Vercel). O primário azul transmite confiança sem competir com a semântica ganho/perda (verde/vermelho), que fica reservada exclusivamente para valores financeiros.

### Gráficos (`--chart-1..5`)
Azul 250 · Esmeralda 160 · Âmbar 80 · Violeta 300 · Laranja 40 — hues equidistantes, luminância 0.65–0.80, distinguíveis para daltonismo comum (protanopia/deuteranopia).

## Tipografia

| Papel | Fonte | Detalhes |
|---|---|---|
| UI | **Inter** (400–800) | `font-feature-settings: cv02/cv03/cv04/cv11` (formas alternativas mais elegantes) |
| Números | **JetBrains Mono** (400–700) | `font-variant-numeric: tabular-nums` — colunas de valores alinham perfeitamente |

Carregadas via Google Fonts em `client/index.html`, com fallback de sistema.

## Componentes e Utilitários

- `.card-interactive` — elevação sutil no hover (border + shadow + translateY -1px, 200ms)
- `.text-gradient-hero` — gradiente branco→azul para o número de patrimônio na Home
- Scrollbar fina temática, `::selection` no primário, `:focus-visible` com anel consistente
- `prefers-reduced-motion` respeitado globalmente (WCAG 2.3.3)

## Layout

- **Sidebar** (240px): navegação agrupada em seções — *Carteira*, *Mercado*, *Inteligência* — com labels uppercase, indicador de aba ativa (barra vertical no primário) e logo com marca gradiente
- **Mobile**: drawer com overlay + topbar com backdrop-blur
- **Home**: hero de Patrimônio Total (número grande em gradiente + chip "ao vivo" + variação inline), seguido de grid de 3 KPIs (Rentabilidade Total, Maior Posição, Caixa)

## Convenções

1. Valores financeiros: sempre `font-mono` (tabular)
2. Ganho = `text-emerald-*`, perda = `text-red-400` — nunca usar o primário para semântica de valor
3. Âmbar (`--warning`) reservado para alertas e features de destaque
4. Cards: `bg-card/50 backdrop-blur-sm border-border/50` + `card-interactive` quando clicável/KPI
