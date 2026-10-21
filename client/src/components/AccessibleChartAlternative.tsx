import { useId, type ReactNode } from "react";

export type AccessibleChartColumn<Row> = {
  id: string;
  label: ReactNode;
  render: (row: Row, index: number) => ReactNode;
};

type AccessibleChartAlternativeProps<Row> = {
  title: string;
  summary: ReactNode;
  columns: AccessibleChartColumn<Row>[];
  rows: Row[];
};

/**
 * Alternativa textual reutilizável para gráficos: oferece um resumo imediato e
 * uma tabela semântica sob demanda para quem não usa a visualização gráfica.
 */
export function AccessibleChartAlternative<Row>({
  title,
  summary,
  columns,
  rows,
}: AccessibleChartAlternativeProps<Row>) {
  const titleId = useId();

  return (
    <section
      className="mt-3 rounded-lg border border-border/50 bg-secondary/10 p-3"
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="text-xs font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {summary}
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-cyan-300 outline-none transition-colors hover:text-cyan-200 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          Ver todos os pontos em tabela ({rows.length})
        </summary>
        <div className="mt-3 overflow-x-auto rounded-md border border-border/50">
          <table className="w-full min-w-max text-left text-xs">
            <caption className="caption-top px-3 py-2 text-left text-xs text-muted-foreground">
              {title}: {rows.length}{" "}
              {rows.length === 1 ? "ponto consolidado" : "pontos consolidados"}.
            </caption>
            <thead className="border-y border-border/50 bg-secondary/40 text-muted-foreground">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.id}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 font-medium"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.length > 0 ? (
                rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="align-top">
                    {columns.map(column => (
                      <td
                        key={column.id}
                        className="whitespace-nowrap px-3 py-2 text-foreground"
                      >
                        {column.render(row, rowIndex)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-3 text-muted-foreground"
                  >
                    Não há pontos disponíveis para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
