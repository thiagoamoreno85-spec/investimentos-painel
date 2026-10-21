import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, type ComponentType } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BalanceVisibilityProvider } from "./contexts/BalanceVisibilityContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

function PageLoadingFallback() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden="true"
        />
        <span>Carregando página...</span>
      </div>
    </main>
  );
}

function lazyPage(loader: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(loader);

  return function LazyPage() {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <Page />
      </Suspense>
    );
  };
}

const Home = lazyPage(() => import("./pages/Home"));
const Alocacao = lazyPage(() => import("./pages/Alocacao"));
const Rentabilidade = lazyPage(() => import("./pages/Rentabilidade"));
const RentabilidadeDetalhada = lazyPage(() => import("./pages/RentabilidadeDetalhada"));
const Aportes = lazyPage(() => import("./pages/Aportes"));
const Patrimonio = lazyPage(() => import("./pages/Patrimonio"));
const Transacoes = lazyPage(() => import("./pages/Transacoes"));
const Proventos = lazyPage(() => import("./pages/Proventos"));
const Alertas = lazyPage(() => import("./pages/Alertas"));
const MelhorCompra = lazyPage(() => import("./pages/MelhorCompra"));
const DashboardMercado = lazyPage(() => import("./pages/DashboardMercado"));
const Noticias = lazyPage(() => import("./pages/Noticias"));
const Calendario = lazyPage(() => import("./pages/Calendario"));
const Configuracoes = lazyPage(() => import("./pages/Configuracoes"));
const NotFound = lazyPage(() => import("./pages/NotFound"));

function protectedPage(Component: ComponentType) {
  return function AuthenticatedPage() {
    return <ProtectedRoute component={Component} />;
  };
}

const ProtectedHome = protectedPage(Home);
const ProtectedAlocacao = protectedPage(Alocacao);
const ProtectedRentabilidade = protectedPage(Rentabilidade);
const ProtectedRentabilidadeDetalhada = protectedPage(RentabilidadeDetalhada);
const ProtectedAportes = protectedPage(Aportes);
const ProtectedPatrimonio = protectedPage(Patrimonio);
const ProtectedTransacoes = protectedPage(Transacoes);
const ProtectedProventos = protectedPage(Proventos);
const ProtectedAlertas = protectedPage(Alertas);
const ProtectedMelhorCompra = protectedPage(MelhorCompra);
const ProtectedDashboardMercado = protectedPage(DashboardMercado);
const ProtectedNoticias = protectedPage(Noticias);
const ProtectedCalendario = protectedPage(Calendario);
const ProtectedConfiguracoes = protectedPage(Configuracoes);

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={ProtectedHome} />
      <Route path={"/alocacao"} component={ProtectedAlocacao} />
      <Route path={"/rentabilidade"} component={ProtectedRentabilidade} />
      <Route path={"/rentabilidade/detalhes"} component={ProtectedRentabilidadeDetalhada} />
      <Route path={"/aportes"} component={ProtectedAportes} />
      <Route path={"/patrimonio"} component={ProtectedPatrimonio} />
      <Route path={"/transacoes"} component={ProtectedTransacoes} />
      <Route path={"/dividendos"} component={ProtectedProventos} />
      <Route path={"/alertas"} component={ProtectedAlertas} />
      <Route path={"/melhor-compra"} component={ProtectedMelhorCompra} />
      <Route path={"/mercado"} component={ProtectedDashboardMercado} />
      <Route path={"/noticias"} component={ProtectedNoticias} />
      <Route path={"/calendario"} component={ProtectedCalendario} />
      <Route path={"/configuracoes"} component={ProtectedConfiguracoes} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <BalanceVisibilityProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </BalanceVisibilityProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
export default App;
