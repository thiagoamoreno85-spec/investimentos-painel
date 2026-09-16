import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardMercadoSource = readFileSync(
  new URL("../client/src/pages/DashboardMercado.tsx", import.meta.url),
  "utf8",
);

describe("estrutura móvel dos cards de mercado", () => {
  it("separa a identificação do ativo da grade compacta de indicadores", () => {
    expect(dashboardMercadoSource).toContain('className="space-y-2 sm:hidden"');
    expect(dashboardMercadoSource).toContain('className="grid grid-cols-3 gap-2 border-t border-border/35 pt-2"');
    expect(dashboardMercadoSource).toContain('className="break-all font-mono text-base font-bold leading-tight text-foreground"');
  });

  it("mantém a grade detalhada exclusivamente a partir do breakpoint sm", () => {
    expect(dashboardMercadoSource).toContain('className="hidden grid-cols-[minmax(0,2fr)_minmax(6rem,1fr)_minmax(4.5rem,0.7fr)_minmax(4.5rem,0.7fr)_minmax(6.5rem,1fr)_1rem] items-center gap-2 sm:grid"');
  });
});
