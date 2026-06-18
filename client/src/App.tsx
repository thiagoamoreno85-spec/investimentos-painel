import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Alocacao from "./pages/Alocacao";
import Rentabilidade from "./pages/Rentabilidade";
import Aportes from "./pages/Aportes";
import Transacoes from "./pages/Transacoes";
import Dividendos from "./pages/Dividendos";
import Alertas from "./pages/Alertas";
import MelhorCompra from "./pages/MelhorCompra";
import DashboardMercado from "./pages/DashboardMercado";
import Noticias from "./pages/Noticias";
import Calendario from "./pages/Calendario";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/alocacao"} component={Alocacao} />
      <Route path={"/rentabilidade"} component={Rentabilidade} />
      <Route path={"/aportes"} component={Aportes} />
      <Route path={"/transacoes"} component={Transacoes} />
      <Route path={"/dividendos"} component={Dividendos} />
      <Route path={"/alertas"} component={Alertas} />
      <Route path={"/melhor-compra"} component={MelhorCompra} />
      <Route path={"/mercado"} component={DashboardMercado} />
      <Route path={"/noticias"} component={Noticias} />
      <Route path={"/calendario"} component={Calendario} />
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
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
export default App;
