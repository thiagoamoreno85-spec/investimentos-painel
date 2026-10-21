import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

type PrivacyMaskProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "span";
};

/**
 * Exibe valores financeiros somente quando a preferência de visibilidade está ativa.
 * O conteúdo sensível não é inserido no DOM enquanto estiver oculto.
 */
export function PrivacyMask({ children, className, as: Tag = "div" }: PrivacyMaskProps) {
  const { showBalances } = useBalanceVisibility();

  if (!showBalances) {
    return (
      <Tag className={cn("select-none", className)} aria-label="Conteúdo financeiro oculto">
        ••••
      </Tag>
    );
  }

  return <Tag className={className}>{children}</Tag>;
}
