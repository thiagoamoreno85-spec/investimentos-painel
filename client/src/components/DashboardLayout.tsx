import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, PieChart, TrendingUp, Wallet, Settings, LogOut } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Visão Geral" },
    { href: "/alocacao", icon: PieChart, label: "Alocação" },
    { href: "/rentabilidade", icon: TrendingUp, label: "Rentabilidade" },
    { href: "/aportes", icon: Wallet, label: "Aportes" },
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

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground w-full transition-colors">
            <Settings className="w-5 h-5" />
            Configurações
          </button>
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors">
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 border-b border-border bg-card flex items-center px-4 md:hidden">
          <h1 className="text-lg font-bold text-primary">
            Manus<span className="text-foreground">Invest</span>
          </h1>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
