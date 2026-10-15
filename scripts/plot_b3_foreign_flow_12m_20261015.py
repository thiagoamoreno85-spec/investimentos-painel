from __future__ import annotations

import csv
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "research" / "b3_fluxo_estrangeiro_mensal_20261015.csv"
OUTPUT = ROOT / "research" / "grafico_fluxo_estrangeiro_b3_12m_20261015.png"

rows: list[dict[str, str]] = []
with SOURCE.open(encoding="utf-8", newline="") as csv_file:
    rows = list(csv.DictReader(csv_file))

labels = [row["rotulo"] for row in rows]
values = [float(row["saldo_liquido_r_milhoes"]) / 1000 for row in rows]
complete = [row["periodo_completo"] == "sim" for row in rows]
colors = ["#34d399" if value >= 0 else "#fb7185" for value in values]
colors[-1] = "#60a5fa"

plt.style.use("dark_background")
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "axes.titleweight": "bold",
    "axes.labelcolor": "#cbd5e1",
    "xtick.color": "#cbd5e1",
    "ytick.color": "#cbd5e1",
})

fig, ax = plt.subplots(figsize=(15, 8), dpi=180)
fig.patch.set_facecolor("#070b14")
ax.set_facecolor("#0b1220")

bars = ax.bar(labels, values, width=0.64, color=colors, edgecolor="#111827", linewidth=1.1, zorder=3)
ax.axhline(0, color="#94a3b8", linewidth=1.15, zorder=2)
ax.grid(axis="y", color="#334155", alpha=0.42, linewidth=0.8, zorder=0)
ax.set_axisbelow(True)
ax.spines[["top", "right", "left", "bottom"]].set_visible(False)
ax.set_ylim(min(values) - 4.2, max(values) + 5.2)
ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"R$ {value:.0f} bi"))
ax.tick_params(axis="x", length=0, pad=10)
ax.tick_params(axis="y", length=0)

for index, (bar, value) in enumerate(zip(bars, values)):
    vertical_offset = 0.72 if value >= 0 else -0.92
    va = "bottom" if value >= 0 else "top"
    ax.text(
        bar.get_x() + bar.get_width() / 2,
        value + vertical_offset,
        f"{value:+.1f}",
        ha="center",
        va=va,
        color="#f8fafc",
        fontsize=9.4,
        fontweight="bold",
    )
    if not complete[index]:
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            value / 2,
            "parcial\naté 13/10",
            ha="center",
            va="center",
            color="#e0f2fe",
            fontsize=8.5,
            fontweight="bold",
        )

ax.set_title("Aportes líquidos de investidores estrangeiros na B3", loc="left", fontsize=20, pad=26, color="#f8fafc")
ax.text(
    0,
    1.015,
    "Saldo mensal — compras + IPO/follow-on − vendas | R$ bilhões | novembro/2025 a outubro/2026",
    transform=ax.transAxes,
    color="#94a3b8",
    fontsize=11,
)

fig.text(
    0.125,
    0.035,
    "Fonte: B3, Relatório Dados de Mercado. Out/26 é parcial e não é comparável a meses completos.\n"
    "O fluxo do EWZ é apresentado separadamente: mede criações/resgates do ETF nos EUA e não deve ser somado ao saldo da B3.",
    color="#94a3b8",
    fontsize=9.4,
)

fig.subplots_adjust(left=0.10, right=0.98, top=0.84, bottom=0.20)
fig.savefig(OUTPUT, facecolor=fig.get_facecolor(), bbox_inches=None)
print(OUTPUT)
