import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBalanceVisibility } from "@/contexts/BalanceVisibilityContext";

type PrivacyMaskProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "span";
};

/** Oculta visualmente blocos que exibem dados financeiros pessoais sem impedir a navegação da tela. */
export function PrivacyMask({ children, className, as: Tag = "div" }: PrivacyMaskProps) {
  const { showBalances } = useBalanceVisibility();

  return (
    <Tag
      className={cn(
        "transition-[filter,opacity] duration-200",
        !showBalances && "blur-sm select-none",
        className
      )}
      aria-label={showBalances ? undefined : "Valores financeiros ocultos"}
    >
      {children}
    </Tag>
  );
}
