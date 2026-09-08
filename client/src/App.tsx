import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BalanceVisibilityProvider } from "./contexts/BalanceVisibilityContext";
import Home from "./pages/Home";
import Alocacao from "./pages/Alocacao";
import Rentabilidade from "./pages/Rentabilidade";
import RentabilidadeDetalhada from "./pages/RentabilidadeDetalhada";
import Aportes from "./pages/Aportes";
import Patrimonio from "./pages/Patrimonio";
import Transacoes from "./pages/Transacoes";
import Proventos from "./pages/Proventos";
import Alertas from "./pages/Alertas";
import MelhorCompra from "./pages/MelhorCompra";
import DashboardMercado from "./pages/DashboardMercado";
import Noticias from "./pages/Noticias";
import Calendario from "./pages/Calendario";
import Configuracoes from "./pages/Configuracoes";
import { ProtectedRoute } from "./components/ProtectedRoute";

function protectedPage(Component: React.ComponentType) {
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
