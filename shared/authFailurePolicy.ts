export type AuthErrorLike = {
  message?: string;
  data?: { code?: string } | null;
};

/** Evita redirecionar para login quando a sessão pode estar válida, mas a rede falhou. */
export function isConfirmedUnauthorized(error: AuthErrorLike | null | undefined, unauthenticatedMessage: string): boolean {
  if (!error) return false;
  return error.data?.code === "UNAUTHORIZED" || error.message === unauthenticatedMessage;
}

/** A ausência de usuário sem erro representa sessão ausente; falha de rede exige nova tentativa, não logout. */
export function shouldRedirectToLogin(
  userExists: boolean,
  error: AuthErrorLike | null | undefined,
  unauthenticatedMessage: string,
): boolean {
  return !userExists && (!error || isConfirmedUnauthorized(error, unauthenticatedMessage));
}
