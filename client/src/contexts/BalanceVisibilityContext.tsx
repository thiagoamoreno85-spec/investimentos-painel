import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { parseBalanceVisibilityPreference } from "@shared/balanceVisibility";

interface BalanceVisibilityContextType {
  showBalances: boolean;
  toggleShowBalances: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextType | undefined>(undefined);

/**
 * Lê a preferência antes da primeira renderização no navegador. No servidor e
 * quando o armazenamento não está disponível, adota privacidade por padrão.
 */
function getInitialBalanceVisibility(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return parseBalanceVisibilityPreference(window.localStorage.getItem("showBalances"));
  } catch {
    return false;
  }
}

export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [showBalances, setShowBalances] = useState(getInitialBalanceVisibility);

  useEffect(() => {
    try {
      window.localStorage.setItem("showBalances", JSON.stringify(showBalances));
    } catch {
      // Armazenamento pode estar indisponível (modo privado, políticas do navegador etc.).
    }
  }, [showBalances]);

  const toggleShowBalances = () => {
    setShowBalances((prev) => !prev);
  };

  return (
    <BalanceVisibilityContext.Provider value={{ showBalances, toggleShowBalances }}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  const context = useContext(BalanceVisibilityContext);
  if (context === undefined) {
    throw new Error("useBalanceVisibility deve ser usado dentro de BalanceVisibilityProvider");
  }
  return context;
}
