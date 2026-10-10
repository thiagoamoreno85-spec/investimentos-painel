import { describe, expect, it } from "vitest";
import { chooseScheduledOwner } from "./services/scheduledOwnerPolicy";

describe("chooseScheduledOwner", () => {
  const configured = { id: 1, label: "configurado" };
  const administrator = { id: 2, label: "administrador" };

  it("prioriza o proprietário configurado", () => {
    expect(chooseScheduledOwner(configured, administrator)).toEqual({
      user: configured,
      source: "owner_open_id",
    });
  });

  it("usa o administrador como fallback seguro", () => {
    expect(chooseScheduledOwner(undefined, administrator)).toEqual({
      user: administrator,
      source: "admin_fallback",
    });
  });

  it("retorna nulo sem usuário elegível", () => {
    expect(chooseScheduledOwner(undefined, undefined)).toBeNull();
  });
});
