import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TrpcContext } from "./_core/types/manusTypes";

/**
 * Testes para patrimonial router (CRUD de ativos imobilizados e passivos)
 * Usa appRouter.createCaller() para invocar procedures com contexto autenticado
 */

const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
const mockContext: TrpcContext = {
  req: {} as any,
  res: {} as any,
  user: mockUser,
};

describe("patrimonial router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(mockContext);
  });

  describe("createAsset", () => {
    it("deve criar um ativo imobilizado com sucesso", async () => {
      const result = await caller.patrimonial.createAsset({
        name: "Apartamento Barra",
        assetType: "imovel",
        description: "Imóvel residencial",
        currentValue: 500000,
        acquisitionValue: 400000,
        acquisitionDate: new Date("2020-01-15"),
        notes: "Financiado",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    it("deve criar um crédito com dados do devedor", async () => {
      const result = await caller.patrimonial.createAsset({
        name: "Empréstimo para João",
        assetType: "credito",
        currentValue: 50000,
        debtorName: "João Silva",
        dueDate: new Date("2026-12-31"),
        interestRate: 5,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    it("deve validar que currentValue é positivo", async () => {
      try {
        await caller.patrimonial.createAsset({
          name: "Ativo inválido",
          assetType: "imovel",
          currentValue: -100, // Inválido
        });
        expect.fail("Deveria ter lançado erro");
      } catch (err: any) {
        // Zod retorna erro com informações de validação
        const errorStr = JSON.stringify(err);
        expect(errorStr.toLowerCase()).toMatch(/positive|too small/);
      }
    });
  });

  describe("listAssets", () => {
    it("deve retornar lista vazia ou com ativos", async () => {
      const assets = await caller.patrimonial.listAssets();
      expect(Array.isArray(assets)).toBe(true);
    });

    it("deve retornar ativos com valores parseados como números", async () => {
      // Criar um ativo
      await caller.patrimonial.createAsset({
        name: "Veículo Teste",
        assetType: "veiculo",
        currentValue: 80000,
      });

      const assets = await caller.patrimonial.listAssets();
      expect(assets.length).toBeGreaterThan(0);

      const asset = assets[0];
      expect(typeof asset.currentValue).toBe("number");
      expect(asset.currentValue).toBeGreaterThan(0);
    });
  });

  describe("createLiability", () => {
    it("deve criar um passivo (financiamento) com sucesso", async () => {
      const result = await caller.patrimonial.createLiability({
        name: "Financiamento Imóvel",
        creditor: "Caixa Econômica",
        originalAmount: 300000,
        installmentValue: 2500,
        totalInstallments: 120,
        interestRate: 4.5,
        startDate: new Date("2020-01-01"),
        endDate: new Date("2030-01-01"),
      });

      expect(result).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
    });

    it("deve validar que originalAmount é positivo", async () => {
      try {
        await caller.patrimonial.createLiability({
          name: "Passivo inválido",
          originalAmount: -50000, // Inválido
          startDate: new Date(),
        });
        expect.fail("Deveria ter lançado erro");
      } catch (err: any) {
        const errorStr = JSON.stringify(err);
        expect(errorStr.toLowerCase()).toMatch(/positive|too small/);
      }
    });
  });

  describe("listLiabilities", () => {
    it("deve retornar lista de passivos com valores parseados", async () => {
      // Criar um passivo
      await caller.patrimonial.createLiability({
        name: "Empréstimo Pessoal",
        originalAmount: 50000,
        startDate: new Date(),
      });

      const liabilities = await caller.patrimonial.listLiabilities();
      expect(Array.isArray(liabilities)).toBe(true);

      if (liabilities.length > 0) {
        const liability = liabilities[0];
        expect(typeof liability.originalAmount).toBe("number");
        expect(typeof liability.remainingBalance).toBe("number");
      }
    });
  });

  describe("registerPayment", () => {
    it("deve registrar pagamento e atualizar saldo do passivo", async () => {
      // Criar um passivo
      const liabilityResult = await caller.patrimonial.createLiability({
        name: "Dívida Teste",
        originalAmount: 10000,
        startDate: new Date(),
      });

      const liabilityId = liabilityResult.id;

      // Registrar pagamento
      const paymentResult = await caller.patrimonial.registerPayment({
        liabilityId,
        amount: 2000,
        paymentDate: new Date(),
        installmentNumber: 1,
      });

      expect(paymentResult.success).toBe(true);
      expect(paymentResult.newBalance).toBe(8000); // 10000 - 2000
    });

    it("deve não permitir pagamento negativo", async () => {
      try {
        await caller.patrimonial.registerPayment({
          liabilityId: 999,
          amount: -1000, // Inválido
          paymentDate: new Date(),
        });
        expect.fail("Deveria ter lançado erro");
      } catch (err: any) {
        const errorStr = JSON.stringify(err);
        expect(errorStr.toLowerCase()).toMatch(/positive|too small/);
      }
    });
  });

  describe("getConsolidatedNetWorth", () => {
    it("deve retornar Net Worth consolidado com estrutura correta", async () => {
      const summary = await caller.patrimonial.getConsolidatedNetWorth();

      expect(summary).toBeDefined();
      expect(typeof summary.patrimonialAssets).toBe("number");
      expect(typeof summary.patrimonialLiabilities).toBe("number");
      expect(typeof summary.patrimonialNetWorth).toBe("number");
      expect(summary.description).toContain("Patrimônio Líquido");
    });

    it("deve calcular Net Worth como Ativos - Passivos", async () => {
      // Obter resumo ANTES de criar dados
      const beforeSummary = await caller.patrimonial.getConsolidatedNetWorth();
      const beforeAssets = beforeSummary.patrimonialAssets;
      const beforeLiabilities = beforeSummary.patrimonialLiabilities;

      // Criar ativo
      await caller.patrimonial.createAsset({
        name: "Casa Teste Isolada",
        assetType: "imovel",
        currentValue: 500000,
      });

      // Criar passivo
      await caller.patrimonial.createLiability({
        name: "Financiamento Teste Isolado",
        originalAmount: 200000,
        startDate: new Date(),
      });

      const summary = await caller.patrimonial.getConsolidatedNetWorth();

      // Verificar que os valores aumentaram
      expect(summary.patrimonialAssets).toBeGreaterThan(beforeAssets);
      expect(summary.patrimonialLiabilities).toBeGreaterThan(beforeLiabilities);

      // Net Worth = (beforeAssets + 500000) - (beforeLiabilities + 200000)
      const expectedNetWorth = beforeAssets + 500000 - beforeLiabilities - 200000;
      expect(summary.patrimonialNetWorth).toBe(expectedNetWorth);
    });
  });

  describe("getSummary", () => {
    it("deve retornar resumo patrimonial com breakdown por tipo", async () => {
      const summary = await caller.patrimonial.getSummary();

      expect(summary).toBeDefined();
      expect(typeof summary.totalAssets).toBe("number");
      expect(typeof summary.totalLiabilities).toBe("number");
      expect(typeof summary.netWorth).toBe("number");
      expect(typeof summary.assetCount).toBe("number");
      expect(typeof summary.liabilityCount).toBe("number");
      expect(typeof summary.assetsByType).toBe("object");
    });
  });

  describe("deleteAsset", () => {
    it("deve marcar ativo como inativo (soft delete) e removê-lo da listagem", async () => {
      // Criar ativo
      const assetResult = await caller.patrimonial.createAsset({
        name: "Ativo a deletar",
        assetType: "equipamento",
        currentValue: 5000,
      });

      const assetId = assetResult.id;

      // Deletar
      const deleteResult = await caller.patrimonial.deleteAsset({ id: assetId });
      expect(deleteResult.success).toBe(true);

      // Verificar que não aparece mais na lista (filtrado por isActive = 1)
      const assets = await caller.patrimonial.listAssets();
      const deleted = assets.find((a) => a.id === assetId);
      expect(deleted).toBeUndefined();
    });
  });
});
