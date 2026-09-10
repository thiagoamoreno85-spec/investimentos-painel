import { describe, expect, it } from "vitest";
import { shouldStartLoginAttempt } from "../shared/authRecoveryPolicy";

describe("recuperação de sessão no navegador", () => {
  it("inicia uma única tentativa automática quando a sessão ainda não existe", () => {
    expect(
      shouldStartLoginAttempt({
        hasUser: false,
        isLoading: false,
        shouldRedirectToLogin: true,
        loginAlreadyAttempted: false,
      })
    ).toBe(true);
  });

  it("evita ciclo de autenticação depois de uma tentativa sem cookie de sessão", () => {
    expect(
      shouldStartLoginAttempt({
        hasUser: false,
        isLoading: false,
        shouldRedirectToLogin: true,
        loginAlreadyAttempted: true,
      })
    ).toBe(false);
  });

  it("não interfere com carregamento, sessão válida ou falha de rede", () => {
    expect(
      shouldStartLoginAttempt({
        hasUser: false,
        isLoading: true,
        shouldRedirectToLogin: true,
        loginAlreadyAttempted: false,
      })
    ).toBe(false);
    expect(
      shouldStartLoginAttempt({
        hasUser: true,
        isLoading: false,
        shouldRedirectToLogin: true,
        loginAlreadyAttempted: false,
      })
    ).toBe(false);
    expect(
      shouldStartLoginAttempt({
        hasUser: false,
        isLoading: false,
        shouldRedirectToLogin: false,
        loginAlreadyAttempted: false,
      })
    ).toBe(false);
  });
});
