import { describe, expect, it } from "vitest";
import { combineDeclaredReturnBaseline } from "../shared/declaredReturnBaseline";

describe("combineDeclaredReturnBaseline", () => {
  it("preserva a base declarada e soma apenas fechamentos posteriores", () => {
    const result = combineDeclaredReturnBaseline(
      { effectiveDate: "2026-10-21", returnValueBRL: 62720.96 },
      [
        { date: "2026-10-20", returnValueBRL: 1000 },
        { date: "2026-10-21", returnValueBRL: -300 },
        { date: "2026-10-22", returnValueBRL: 450 },
        { date: "2026-10-23", returnValueBRL: -125 },
      ],
    );

    expect(result.declaredReturnBRL).toBe(62720.96);
    expect(result.officialReturnSinceBRL).toBe(325);
    expect(result.totalReturnBRL).toBe(63045.96);
    expect(result.officialCloseCountSince).toBe(2);
    expect(result.firstOfficialCloseAfterBaseline).toBe("2026-10-22");
    expect(result.lastOfficialCloseAfterBaseline).toBe("2026-10-23");
  });

  it("não cria ganho adicional quando ainda não existe fechamento posterior", () => {
    const result = combineDeclaredReturnBaseline(
      { effectiveDate: "2026-10-21", returnValueBRL: 62720.96 },
      [{ date: "2026-10-21", returnValueBRL: 99 }],
    );

    expect(result.totalReturnBRL).toBe(62720.96);
    expect(result.officialReturnSinceBRL).toBe(0);
    expect(result.officialCloseCountSince).toBe(0);
    expect(result.firstOfficialCloseAfterBaseline).toBeNull();
  });
});
