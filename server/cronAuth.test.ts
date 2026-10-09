import { describe, expect, it } from "vitest";
import { isAuthenticatedCron } from "./_core/cronAuth";

describe("isAuthenticatedCron", () => {
  it("aceita somente identidade cron autenticada com taskUid", () => {
    expect(isAuthenticatedCron({ isCron: true, taskUid: "task-123" })).toBe(true);
  });

  it("rejeita usuário comum, cron sem taskUid e valores ausentes", () => {
    expect(isAuthenticatedCron({ isCron: false, taskUid: "task-123" })).toBe(false);
    expect(isAuthenticatedCron({ isCron: true })).toBe(false);
    expect(isAuthenticatedCron(null)).toBe(false);
  });
});
