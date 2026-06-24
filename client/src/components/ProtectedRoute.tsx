import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { getLoginUrl } from "@/const";

interface ProtectedRouteProps {
  component: React.ComponentType;
}

export function ProtectedRoute({ component: Component }: ProtectedRouteProps) {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      window.location.href = getLoginUrl();
    }
  }, [isLoading, error, user]);

  if (isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  if (error || !user) {
    // Redirect is happening via useEffect, show skeleton while redirecting
    return <DashboardLayoutSkeleton />;
  }

  return <Component />;
}
