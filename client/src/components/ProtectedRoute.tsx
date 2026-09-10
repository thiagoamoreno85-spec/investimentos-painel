import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { shouldRedirectToLogin } from "@shared/authFailurePolicy";
import { shouldStartLoginAttempt } from "@shared/authRecoveryPolicy";

const LOGIN_ATTEMPT_STORAGE_KEY = "manus-invest-auth-attempted";

function readLoginAttempt(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY) === "1";
}

interface ProtectedRouteProps {
  component: React.ComponentType;
}

export function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const [loginAlreadyAttempted, setLoginAlreadyAttempted] = useState(readLoginAttempt);
  const { data: user, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: 1,
    retryDelay: 500,
  });
  const shouldRedirect = shouldRedirectToLogin(Boolean(user), error, UNAUTHED_ERR_MSG);
  const shouldStartLogin = shouldStartLoginAttempt({
    hasUser: Boolean(user),
    isLoading,
    shouldRedirectToLogin: shouldRedirect,
    loginAlreadyAttempted,
  });

  useEffect(() => {
    if (user && typeof window !== "undefined") {
      window.sessionStorage.removeItem(LOGIN_ATTEMPT_STORAGE_KEY);
      if (loginAlreadyAttempted) setLoginAlreadyAttempted(false);
      return;
    }

    if (shouldStartLogin && typeof window !== "undefined") {
      window.sessionStorage.setItem(LOGIN_ATTEMPT_STORAGE_KEY, "1");
      setLoginAlreadyAttempted(true);
      window.location.href = getLoginUrl();
    }
  }, [loginAlreadyAttempted, shouldStartLogin, user]);

  const restartLogin = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(LOGIN_ATTEMPT_STORAGE_KEY);
    window.location.href = getLoginUrl();
  };

  if (isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    if (shouldStartLogin) {
      return <DashboardLayoutSkeleton />;
    }

    if (shouldRedirect && loginAlreadyAttempted) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <section className="w-full max-w-lg rounded-xl border border-amber-500/40 bg-card p-6 shadow-sm">
            <h1 className="text-lg font-semibold">A entrada não foi concluída</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O navegador voltou do login sem criar a sessão protegida do painel. Para acessar, use
              uma janela normal e permita cookies para este endereço e para a Manus.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Desative a navegação privada para este acesso.</li>
              <li>Permita cookies e desative bloqueadores de rastreamento estritos.</li>
              <li>Após ajustar o navegador, clique em entrar novamente.</li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={restartLogin}>Entrar novamente</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Atualizar página
              </Button>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="w-full max-w-md rounded-xl border border-amber-500/30 bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Não foi possível confirmar a sessão</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A conexão falhou antes de carregar o painel. Sua sessão não foi encerrada.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </section>
      </main>
    );
  }

  return <Component />;
}
