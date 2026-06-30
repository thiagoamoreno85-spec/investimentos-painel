import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BalanceVisibilityContextType {
  showBalances: boolean;
  toggleShowBalances: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextType | undefined>(undefined);

export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [showBalances, setShowBalances] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Carregar estado do localStorage ao montar
  useEffect(() => {
    const saved = localStorage.getItem("showBalances");
    if (saved !== null) {
      setShowBalances(JSON.parse(saved));
    }
    setMounted(true);
  }, []);

  // Salvar estado no localStorage quando mudar
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("showBalances", JSON.stringify(showBalances));
    }
  }, [showBalances, mounted]);

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
