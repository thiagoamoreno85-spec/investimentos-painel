import { describe, expect, it } from "vitest";
import { isConfirmedUnauthorized, shouldRedirectToLogin } from "../shared/authFailurePolicy";

const UNAUTHED = "Please login (10001)";

describe("política de falhas de autenticação", () => {
  it("redireciona somente sessão ausente ou erro de autenticação confirmado", () => {
    expect(shouldRedirectToLogin(false, undefined, UNAUTHED)).toBe(true);
    expect(shouldRedirectToLogin(false, { data: { code: "UNAUTHORIZED" } }, UNAUTHED)).toBe(true);
    expect(shouldRedirectToLogin(false, { message: UNAUTHED }, UNAUTHED)).toBe(true);
    expect(shouldRedirectToLogin(true, undefined, UNAUTHED)).toBe(false);
  });

  it("não confunde timeout ou falha de rede com logout", () => {
    const timeout = { message: "A requisição excedeu o prazo" };
    expect(isConfirmedUnauthorized(timeout, UNAUTHED)).toBe(false);
    expect(shouldRedirectToLogin(false, timeout, UNAUTHED)).toBe(false);
  });
});
