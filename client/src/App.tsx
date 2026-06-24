import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Home = lazy(() => import("./pages/Home"));
const Alocacao = lazy(() => import("./pages/Alocacao"));
const Rentabilidade = lazy(() => import("./pages/Rentabilidade"));
const Aportes = lazy(() => import("./pages/Aportes"));
const Transacoes = lazy(() => import("./pages/Transacoes"));
const Dividendos = lazy(() => import("./pages/Dividendos"));
const Alertas = lazy(() => import("./pages/Alertas"));
const MelhorCompra = lazy(() => import("./pages/MelhorCompra"));
const DashboardMercado = lazy(() => import("./pages/DashboardMercado"));
const Noticias = lazy(() => import("./pages/Noticias"));
const Calendario = lazy(() => import("./pages/Calendario"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Router() {
  return (
    <Suspense fallback={<DashboardLayoutSkeleton />}>
      <Switch>
        <Route path={"/"}>{() => <ProtectedRoute component={Home} />}</Route>
        <Route path={"/alocacao"}>{() => <ProtectedRoute component={Alocacao} />}</Route>
        <Route path={"/rentabilidade"}>{() => <ProtectedRoute component={Rentabilidade} />}</Route>
        <Route path={"/aportes"}>{() => <ProtectedRoute component={Aportes} />}</Route>
        <Route path={"/transacoes"}>{() => <ProtectedRoute component={Transacoes} />}</Route>
        <Route path={"/dividendos"}>{() => <ProtectedRoute component={Dividendos} />}</Route>
        <Route path={"/alertas"}>{() => <ProtectedRoute component={Alertas} />}</Route>
        <Route path={"/melhor-compra"}>{() => <ProtectedRoute component={MelhorCompra} />}</Route>
        <Route path={"/mercado"}>{() => <ProtectedRoute component={DashboardMercado} />}</Route>
        <Route path={"/noticias"}>{() => <ProtectedRoute component={Noticias} />}</Route>
        <Route path={"/calendario"}>{() => <ProtectedRoute component={Calendario} />}</Route>
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
export default App;
