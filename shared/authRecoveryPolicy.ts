export type AuthRecoveryInput = {
  hasUser: boolean;
  isLoading: boolean;
  shouldRedirectToLogin: boolean;
  loginAlreadyAttempted: boolean;
};

/**
 * Permite uma única tentativa automática de login por carregamento do painel.
 * Se o callback retornar sem cookie de sessão, a interface exibe recuperação
 * explícita em vez de manter o usuário preso em um ciclo de carregamento.
 */
export function shouldStartLoginAttempt({
  hasUser,
  isLoading,
  shouldRedirectToLogin,
  loginAlreadyAttempted,
}: AuthRecoveryInput): boolean {
  return !hasUser && !isLoading && shouldRedirectToLogin && !loginAlreadyAttempted;
}
