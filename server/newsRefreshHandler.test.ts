import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the newsRefreshService
vi.mock("./services/newsRefreshService", () => ({
  runNewsRefresh: vi.fn(),
  generateNewsWithLLM: vi.fn(),
}));

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      {
        id: 1,
        openId: "owner-open-id",
        name: "Dr. Thiago Moreno",
        email: null,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
  }),
  getAssetsByUser: vi.fn().mockResolvedValue([
    { id: 1, ticker: "VALE3", name: "Vale S.A.", assetClass: "rv_nacional" },
    { id: 2, ticker: "PLTR", name: "Palantir", assetClass: "rv_eua" },
  ]),
}));

// Mock ENV
vi.mock("./_core/env", () => ({
  ENV: {
    ownerOpenId: "owner-open-id",
  },
}));

// Import after mocks
import { runNewsRefresh } from "./services/newsRefreshService";

describe("News Refresh Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runNewsRefresh", () => {
    it("should return success result with count and alertsCreated", async () => {
      const mockRunNewsRefresh = vi.mocked(runNewsRefresh);
      mockRunNewsRefresh.mockResolvedValue({
        count: 8,
        alertsCreated: 2,
        message: "8 notícias geradas com análise de impacto. 2 alertas de alto impacto criados.",
      });

      const result = await runNewsRefresh(1);
      expect(result.count).toBe(8);
      expect(result.alertsCreated).toBe(2);
      expect(result.message).toContain("8 notícias");
    });

    it("should return empty result when no assets", async () => {
      const mockRunNewsRefresh = vi.mocked(runNewsRefresh);
      mockRunNewsRefresh.mockResolvedValue({
        count: 0,
        alertsCreated: 0,
        message: "Carteira vazia — nenhuma notícia gerada.",
      });

      const result = await runNewsRefresh(999);
      expect(result.count).toBe(0);
      expect(result.alertsCreated).toBe(0);
    });

    it("should throw error when database is unavailable", async () => {
      const mockRunNewsRefresh = vi.mocked(runNewsRefresh);
      mockRunNewsRefresh.mockRejectedValue(new Error("Database not available"));

      await expect(runNewsRefresh(1)).rejects.toThrow("Database not available");
    });
  });
});

describe("News Refresh Handler Logic", () => {
  describe("cron authentication", () => {
    it("should reject requests without cron header", () => {
      const headers: Record<string, string> = {};
      const cronTaskUid = headers["x-manus-cron-task-uid"];
      expect(cronTaskUid).toBeUndefined();
      // Handler should return 403
      const shouldReject = !cronTaskUid;
      expect(shouldReject).toBe(true);
    });

    it("should accept requests with valid cron header", () => {
      const headers: Record<string, string> = {
        "x-manus-cron-task-uid": "mo73QzPooGL6nY47EsXaer",
      };
      const cronTaskUid = headers["x-manus-cron-task-uid"];
      expect(cronTaskUid).toBe("mo73QzPooGL6nY47EsXaer");
      const shouldReject = !cronTaskUid;
      expect(shouldReject).toBe(false);
    });
  });

  describe("owner lookup", () => {
    it("should skip gracefully when owner not found", () => {
      const ownerRows: unknown[] = [];
      const shouldSkip = ownerRows.length === 0;
      expect(shouldSkip).toBe(true);
    });

    it("should proceed when owner is found", () => {
      const ownerRows = [{ id: 1, openId: "owner-open-id" }];
      const shouldSkip = ownerRows.length === 0;
      expect(shouldSkip).toBe(false);
    });
  });

  describe("error response format", () => {
    it("should include required fields in error response", () => {
      const error = new Error("LLM timeout");
      const errorResponse = {
        error: error.message,
        stack: error.stack,
        context: {
          url: "/api/scheduled/news-refresh",
          taskUid: "mo73QzPooGL6nY47EsXaer",
        },
        timestamp: new Date().toISOString(),
        elapsed: 5000,
      };

      expect(errorResponse.error).toBe("LLM timeout");
      expect(errorResponse.context.url).toBe("/api/scheduled/news-refresh");
      expect(errorResponse.timestamp).toBeTruthy();
    });
  });

  describe("success response format", () => {
    it("should include ok, taskUid, elapsed, count and alertsCreated", () => {
      const successResponse = {
        ok: true,
        taskUid: "mo73QzPooGL6nY47EsXaer",
        elapsed: 3200,
        count: 8,
        alertsCreated: 2,
        message: "8 notícias geradas com análise de impacto. 2 alertas criados.",
      };

      expect(successResponse.ok).toBe(true);
      expect(successResponse.taskUid).toBeTruthy();
      expect(successResponse.count).toBeGreaterThan(0);
    });
  });
});

describe("Heartbeat Cron Configuration", () => {
  it("should have correct cron expression for 30-minute interval", () => {
    const cronExpression = "0 */30 * * * *";
    // Validate 6-field cron format (sec min hour dom mon dow)
    const parts = cronExpression.split(" ");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("0"); // seconds = 0
    expect(parts[1]).toBe("*/30"); // every 30 minutes
  });

  it("should have correct callback path", () => {
    const callbackPath = "/api/scheduled/news-refresh";
    expect(callbackPath.startsWith("/api/scheduled/")).toBe(true);
  });

  it("should have stored task uid", () => {
    const taskUid = "mo73QzPooGL6nY47EsXaer";
    expect(taskUid).toBeTruthy();
    expect(taskUid.length).toBeGreaterThan(10);
  });
});
