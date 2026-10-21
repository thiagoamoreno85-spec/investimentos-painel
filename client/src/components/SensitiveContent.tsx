import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

type SensitiveContentProps = {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  as?: "div" | "span";
};

/**
 * Protege blocos inteiros (como gráficos e tabelas) sem inserir seu conteúdo no DOM
 * quando os saldos estiverem ocultos.
 */
export function SensitiveContent({
  children,
  fallback = "Conteúdo financeiro oculto",
  className,
  as: Tag = "div",
}: SensitiveContentProps) {
  const { showBalances } = useBalanceVisibility();

  return (
    <Tag
      className={className ? cn(className) : undefined}
      aria-label={showBalances ? undefined : "Conteúdo financeiro oculto"}
    >
      {showBalances ? children : fallback}
    </Tag>
  );
}
