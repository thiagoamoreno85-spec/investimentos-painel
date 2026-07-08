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
  Calendar,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge: number;
  highlight: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
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

  const navGroups: NavGroup[] = [
    {
      label: "Carteira",
      items: [
        { href: "/", icon: LayoutDashboard, label: "Visão Geral", badge: 0, highlight: false },
        { href: "/alocacao", icon: PieChart, label: "Alocação", badge: 0, highlight: false },
        { href: "/rentabilidade", icon: TrendingUp, label: "Rentabilidade", badge: 0, highlight: false },
        { href: "/transacoes", icon: ArrowLeftRight, label: "Transações", badge: 0, highlight: false },
        { href: "/dividendos", icon: DollarSign, label: "Dividendos", badge: 0, highlight: false },
        { href: "/aportes", icon: Wallet, label: "Aportes", badge: 0, highlight: false },
        { href: "/patrimonio", icon: Building2, label: "Patrimônio", badge: 0, highlight: false },
      ],
    },
    {
      label: "Mercado",
      items: [
        { href: "/mercado", icon: Globe, label: "Dashboard Mercado", badge: 0, highlight: false },
        { href: "/noticias", icon: Newspaper, label: "Notícias", badge: unreadNewsCount ?? 0, highlight: false },
        { href: "/alertas", icon: Bell, label: "Alertas", badge: alertCounts?.triggered ?? 0, highlight: false },
        { href: "/calendario", icon: Calendar, label: "Calendário", badge: 0, highlight: false },
      ],
    },
    {
      label: "Inteligência",
      items: [
        { href: "/melhor-compra", icon: Sparkles, label: "Melhor Compra", badge: 0, highlight: true },
      ],
    },
  ];

  const NavLink = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
    const isActive = location === item.href;
    return (
      <Link
        href={item.href}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group ${
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : item.highlight
            ? "text-warning hover:bg-warning/10 border border-warning/20 bg-warning/5"
            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
        }`}
      >
        {/* Indicador de aba ativa */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
        )}
        <item.icon
          className={`w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150 group-hover:scale-105 ${
            item.highlight && !isActive ? "text-warning" : ""
          }`}
        />
        <span className="flex-1 text-sm">{item.label}</span>
        {item.badge > 0 && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] rounded-full bg-warning text-black font-bold min-w-[20px] text-center">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </Link>
    );
  };

  const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} onClick={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const SidebarFooter = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="p-3 border-t border-sidebar-border space-y-0.5">
      <Link
        href="/configuracoes"
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-secondary/70 hover:text-foreground w-full transition-all duration-150 text-sm"
      >
        <Settings className="w-[18px] h-[18px]" />
        Configurações
      </Link>
      <button
        onClick={() => {
          logout();
          onNavigate?.();
        }}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-all duration-150 text-sm"
      >
        <LogOut className="w-[18px] h-[18px]" />
        Sair
      </button>
    </div>
  );

  const Brand = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_-4px_var(--primary)]">
        <TrendingUp className="w-4.5 h-4.5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <div>
        <h1 className={`${compact ? "text-base" : "text-lg"} font-bold tracking-tight leading-none`}>
          Manus<span className="text-primary">Invest</span>
        </h1>
        {!compact && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Dr. Thiago Moreno</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-background flex overflow-hidden">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="w-60 border-r border-sidebar-border bg-sidebar hidden md:flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-sidebar-border/60">
          <Brand />
        </div>

        <SidebarNav />
        <SidebarFooter />
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
          fixed top-0 left-0 z-50 h-full w-72 bg-sidebar border-r border-sidebar-border flex flex-col
          transform transition-transform duration-300 ease-in-out md:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border/60">
          <Brand />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <SidebarNav onNavigate={() => setMobileOpen(false)} />
        <SidebarFooter onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col min-w-0 h-screen">

        {/* Mobile topbar */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 md:hidden flex-shrink-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="absolute left-1/2 -translate-x-1/2">
            <Brand compact />
          </div>

          {/* Quick badges */}
          <div className="flex items-center gap-2">
            {(alertCounts?.triggered ?? 0) > 0 && (
              <Link href="/alertas" className="relative p-1.5" aria-label="Alertas">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] rounded-full bg-warning text-black font-bold flex items-center justify-center">
                  {(alertCounts?.triggered ?? 0) > 9 ? "9+" : alertCounts?.triggered}
                </span>
              </Link>
            )}
            {(unreadNewsCount ?? 0) > 0 && (
              <Link href="/noticias" className="relative p-1.5" aria-label="Notícias">
                <Newspaper className="w-5 h-5 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">
                  {(unreadNewsCount ?? 0) > 9 ? "9+" : unreadNewsCount}
                </span>
              </Link>
            )}
          </div>
        </header>

        {/* Page content — scrollable */}
        <div className="flex-1 overflow-y-auto p-3 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
