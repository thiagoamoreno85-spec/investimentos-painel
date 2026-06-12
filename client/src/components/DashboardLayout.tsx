import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  PieChart,
  TrendingUp,
  Wallet,
  Settings,
  LogOut,
  ArrowLeftRight,
  Bell,
  DollarSign,
  Sparkles,
  Menu,
  X,
  Globe,
  Newspaper,
  ChevronRight,
} from "lucide-react";
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

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

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

  const NavLink = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => {
    const isActive = location === item.href;
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-150 ${
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : item.highlight
            ? "text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 border border-amber-500/20 bg-amber-500/5"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${item.highlight && !isActive ? "text-amber-400" : ""}`} />
        <span className="flex-1 text-sm">{item.label}</span>
        {item.badge > 0 && (
          <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-amber-500 text-black font-bold min-w-[20px] text-center">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
        {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />}
      </Link>
    );
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-border/50">
          <h1 className="text-xl font-bold tracking-tight text-primary">
            Manus<span className="text-foreground">Invest</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Dr. Thiago Moreno</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/configuracoes"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-all duration-150 text-sm"
          >
            <Settings className="w-5 h-5" />
            Configurações
          </Link>
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-all duration-150 text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── MOBILE OVERLAY ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── MOBILE SIDEBAR (drawer) ── */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-72 bg-card border-r border-border flex flex-col
          transform transition-transform duration-300 ease-in-out md:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-primary">
              Manus<span className="text-foreground">Invest</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Dr. Thiago Moreno</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
          ))}
        </nav>

        {/* Drawer footer */}
        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/configuracoes"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-all duration-150 text-sm"
          >
            <Settings className="w-5 h-5" />
            Configurações
          </Link>
          <button
            onClick={() => { logout(); setMobileOpen(false); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-all duration-150 text-sm"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">

        {/* Mobile topbar */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:hidden flex-shrink-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-base font-bold text-primary absolute left-1/2 -translate-x-1/2">
            Manus<span className="text-foreground">Invest</span>
          </h1>

          {/* Quick badges */}
          <div className="flex items-center gap-2">
            {(alertCounts?.triggered ?? 0) > 0 && (
              <Link href="/alertas" className="relative p-1.5">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] rounded-full bg-amber-500 text-black font-bold flex items-center justify-center">
                  {(alertCounts?.triggered ?? 0) > 9 ? "9+" : alertCounts?.triggered}
                </span>
              </Link>
            )}
            {(unreadNewsCount ?? 0) > 0 && (
              <Link href="/noticias" className="relative p-1.5">
                <Newspaper className="w-5 h-5 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">
                  {(unreadNewsCount ?? 0) > 9 ? "9+" : unreadNewsCount}
                </span>
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-hidden flex flex-col p-3 md:p-8 min-h-0">
          <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 min-h-0 h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
