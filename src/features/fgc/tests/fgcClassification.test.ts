import { describe, it, expect } from "vitest";
import { classifyInvestmentForFgc, defaultCoverageForProduct, mapInvestmentTypeToProductCode, validateFgcClassification } from "../services/fgcClassification";
import type { Investment } from "@/lib/models";
import type { FinancialInstitutionRef } from "../types/fgc";

function makeInv(overrides: Partial<Investment> = {}): Investment {
  return {
    id: "i1", name: "T", type: "cdb", institution: "Banco Alfa",
    currentBalance: 100_000, monthlyContribution: 0, annualRate: 0.1,
    startDate: "2024-01-01", active: true,
    createdAt: "2024-01-01", updatedAt: "2024-01-01", ...overrides,
  };
}

describe("fgcClassification - catálogo", () => {
  it("mapeia tipos legados", () => {
    expect(mapInvestmentTypeToProductCode("cdb")).toBe("cdb");
    expect(mapInvestmentTypeToProductCode("lci-lca")).toBe("lci");
    expect(mapInvestmentTypeToProductCode("tesouro-selic")).toBe("tesouro");
    expect(mapInvestmentTypeToProductCode("acao")).toBe("acao");
  });
  it("CDB/RDB/LCI/LCA/LCD/LC/LH potencialmente cobertos", () => {
    ["cdb", "rdb", "lci", "lca", "lcd", "lc", "lh"].forEach(p =>
      expect(defaultCoverageForProduct(p)).toBe("potentially_covered"));
  });
  it("Poupança potencialmente coberta", () =>
    expect(defaultCoverageForProduct("savings")).toBe("potentially_covered"));
  it("Tesouro / Fundo / Debênture / CRI / CRA / LF / LIG não cobertos", () => {
    ["tesouro", "fund", "debenture", "cri", "cra", "lf", "lig"].forEach(p =>
      expect(defaultCoverageForProduct(p)).toBe("not_covered"));
  });
  it("DPGE = garantia especial", () =>
    expect(defaultCoverageForProduct("dpge")).toBe("special_guarantee_review"));
  it("Desconhecido = needs_review", () =>
    expect(defaultCoverageForProduct("other")).toBe("needs_review"));
});

describe("fgcClassification - integração", () => {
  const institutions: FinancialInstitutionRef[] = [
    { id: "inst-1", legalName: "Banco Alfa S.A.", tradeName: "Banco Alfa",
      conglomerateId: "cg-1", fgcAssociationStatus: "associated", active: true, version: "1.0.0" },
  ];
  it("CDB em instituição associada = potentially_covered", () => {
    const r = classifyInvestmentForFgc(makeInv(), institutions, "t1");
    expect(r.coverageStatus).toBe("potentially_covered");
    expect(r.institutionVerified).toBe(true);
  });
  it("CDB em instituição não normalizada NÃO fica coberto automaticamente", () => {
    const r = classifyInvestmentForFgc(makeInv({ institution: "Instituição Random" }), institutions, "t1");
    expect(r.coverageStatus).toBe("needs_review");
    expect(r.institutionVerified).toBe(false);
  });
  it("Tesouro permanece não coberto", () => {
    const r = classifyInvestmentForFgc(makeInv({ type: "tesouro-selic" }), institutions, "t1");
    expect(r.coverageStatus).toBe("not_covered");
  });
  it("validador flaga saldo inválido", () => {
    const errs = validateFgcClassification({
      id: "x", titularId: "t", productCode: "cdb",
      institutionVerified: true, conglomerateVerified: true,
      currentBalance: -1, ownership: "individual", coverageStatus: "potentially_covered",
    });
    expect(errs.length).toBeGreaterThan(0);
  });
});