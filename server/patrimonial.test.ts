import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { TrpcContext } from "./_core/types/manusTypes";

/**
 * Testes de contrato e validação do módulo patrimonial.
 *
 * Regra de segurança: esta suíte nunca executa uma mutação válida e, portanto,
 * não grava ativos, passivos ou pagamentos em banco algum. Os fluxos válidos
 * são verificados manualmente mediante solicitação explícita do usuário.
 */
const mockContext: TrpcContext = {
  req: {} as any,
  res: {} as any,
  user: { id: 9_999_999, name: "Test User", email: "test@example.com" },
};

describe("patrimonial router — contrato sem escrita", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(mockContext);
  });

  it("expõe a procedure de listar ativos", () => {
    expect(Object.keys(appRouter._def.procedures)).toContain("patrimonial.listAssets");
  });

  it("expõe a procedure de criar ativo", () => {
    expect(Object.keys(appRouter._def.procedures)).toContain("patrimonial.createAsset");
  });

  it("expõe a procedure de editar ativo", () => {
    expect(Object.keys(appRouter._def.procedures)).toContain("patrimonial.updateAsset");
  });

  it("expõe a procedure de listar passivos", () => {
    expect(Object.keys(appRouter._def.procedures)).toContain("patrimonial.listLiabilities");
  });

  it("expõe a procedure de criar passivo", () => {
    expect(Object.keys(appRouter._def.procedures)).toContain("patrimonial.createLiability");
  });

  it("expõe a procedure de registrar pagamento", () => {
    expect(Object.keys(appRouter._def.procedures)).toContain("patrimonial.registerPayment");
  });

  it("rejeita ativo sem nome antes de acessar o banco", async () => {
    await expect(caller.patrimonial.createAsset({ name: "", assetType: "imovel", currentValue: 1 })).rejects.toThrow();
  });

  it("rejeita tipo de ativo inválido antes de acessar o banco", async () => {
    await expect(caller.patrimonial.createAsset({ name: "Teste", assetType: "invalido" as any, currentValue: 1 })).rejects.toThrow();
  });

  it("rejeita valor atual não positivo antes de acessar o banco", async () => {
    await expect(caller.patrimonial.createAsset({ name: "Teste", assetType: "imovel", currentValue: 0 })).rejects.toThrow();
  });

  it("rejeita passivo sem nome antes de acessar o banco", async () => {
    await expect(caller.patrimonial.createLiability({ name: "", originalAmount: 1, startDate: new Date() })).rejects.toThrow();
  });

  it("rejeita passivo com valor não positivo antes de acessar o banco", async () => {
    await expect(caller.patrimonial.createLiability({ name: "Teste", originalAmount: -1, startDate: new Date() })).rejects.toThrow();
  });

  it("rejeita passivo sem data inicial antes de acessar o banco", async () => {
    await expect(caller.patrimonial.createLiability({ name: "Teste", originalAmount: 1 } as any)).rejects.toThrow();
  });

  it("rejeita pagamento não positivo antes de acessar o banco", async () => {
    await expect(caller.patrimonial.registerPayment({ liabilityId: 1, amount: 0, paymentDate: new Date() })).rejects.toThrow();
  });

  it("rejeita número de parcela não inteiro antes de acessar o banco", async () => {
    await expect(caller.patrimonial.registerPayment({ liabilityId: 1, amount: 1, paymentDate: new Date(), installmentNumber: 1.5 })).rejects.toThrow();
  });
});
