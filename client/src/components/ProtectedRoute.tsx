import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { shouldRedirectToLogin } from "@shared/authFailurePolicy";

interface ProtectedRouteProps {
  component: React.ComponentType;
}

export function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery(undefined, {
    retry: 1,
    retryDelay: 500,
  });
  const shouldRedirect = shouldRedirectToLogin(Boolean(user), error, UNAUTHED_ERR_MSG);

  useEffect(() => {
    if (!isLoading && shouldRedirect) {
      window.location.href = getLoginUrl();
    }
  }, [isLoading, shouldRedirect]);

  if (isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    if (shouldRedirect) {
      return <DashboardLayoutSkeleton />;
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
