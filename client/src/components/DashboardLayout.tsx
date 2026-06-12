import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, PieChart, TrendingUp, Wallet, Settings, LogOut, ArrowLeftRight, Bell, DollarSign, Sparkles, Menu, X, Globe, Newspaper } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();

  const { data: alertCounts } = trpc.alerts.getAlertCounts.useQuery();
  const { data: unreadNewsCount } = trpc.news.unreadCount.useQuery();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Visão Geral", badge: 0, highlight: false },
    { href: "/alocacao", icon: PieChart, label: "Alocação", badge: 0, highlight: false },
    { href: "/rentabilidade", icon: TrendingUp, label: "Rentabilidade", badge: 0, highlight: false },
    { href: "/transacoes", icon: ArrowLeftRight, label: "Transações", badge: 0, highlight: false },
    { href: "/dividendos", icon: DollarSign, label: "Dividendos", badge: 0, highlight: false },
    { href: "/alertas", icon: Bell, label: "Alertas", badge: alertCounts?.triggered ?? 0, highlight: false },
    { href: "/aportes", icon: Wallet, label: "Aportes", badge: 0, highlight: false },
    { href: "/noticias", icon: Newspaper, label: "Notícias", badge: unreadNewsCount ?? 0, highlight: false },
    { href: "/melhor-compra", icon: Sparkles, label: "Melhor Compra", badge: 0, highlight: true },
    { href: "/mercado", icon: Globe, label: "Dashboard Mercado", badge: 0, highlight: false },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-primary">
            Manus<span className="text-foreground">Invest</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Dr. Thiago Moreno</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : item.highlight
                    ? "text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 border border-amber-500/20 bg-amber-500/5"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${item.highlight && !isActive ? "text-amber-400" : ""}`} />
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-black font-bold min-w-[20px] text-center">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors">
            <Settings className="w-5 h-5" />
            Configurações
          </button>
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:hidden">
          <h1 className="text-lg font-bold text-primary">
            Manus<span className="text-foreground">Invest</span>
          </h1>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-muted-foreground hover:text-foreground">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden bg-card border-b border-border px-4 py-2 space-y-1 max-h-[70vh] overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-black font-bold min-w-[20px] text-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 min-h-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
