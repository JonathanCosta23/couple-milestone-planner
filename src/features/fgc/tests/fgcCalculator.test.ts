import { describe, it, expect } from "vitest";
import {
  calculateFgcDiagnosis, calculateFourYearUsage, calculateOfficialCoverage,
  calculateOfficialExcess, calculatePrudentialExcess, calculatePrudentialLimit,
  calculateProjectedFgcExposure, calculateRemainingCapacity, eligibleAssetBalance,
  groupExposureByConglomerate, allocateJointOwnership,
} from "../services/fgcCalculator";
import { FGC_FALLBACK_RULES } from "../services/fgcInstitutionProvider";
import type { FgcAssetInput } from "../types/fgc";

const rule = FGC_FALLBACK_RULES.ordinary;

function makeAsset(o: Partial<FgcAssetInput> = {}): FgcAssetInput {
  return {
    id: o.id ?? "a1", titularId: "t1", productCode: "cdb",
    institutionKey: "inst-1", conglomerateKey: "cg-1",
    institutionVerified: true, conglomerateVerified: true,
    currentBalance: 100_000, ownership: "individual",
    coverageStatus: "potentially_covered", ...o,
  };
}

describe("fgcCalculator - limites", () => {
  it("abaixo do limite", () => {
    expect(calculateOfficialCoverage(100_000, 250_000)).toBe(100_000);
    expect(calculateOfficialExcess(100_000, 250_000)).toBe(0);
    expect(calculateRemainingCapacity(100_000, 250_000)).toBe(150_000);
  });
  it("igual ao limite", () => {
    expect(calculateOfficialCoverage(250_000, 250_000)).toBe(250_000);
    expect(calculateOfficialExcess(250_000, 250_000)).toBe(0);
  });
  it("acima do limite", () => {
    expect(calculateOfficialCoverage(300_000, 250_000)).toBe(250_000);
    expect(calculateOfficialExcess(300_000, 250_000)).toBe(50_000);
  });
  it("saldo negativo vira zero", () => expect(eligibleAssetBalance(makeAsset({ currentBalance: -10 }))).toBe(0));
  it("principal + rendimento tem preferência", () =>
    expect(eligibleAssetBalance(makeAsset({ principalAmount: 100_000, accruedIncome: 25_000 }))).toBe(125_000));
});

describe("fgcCalculator - margem prudencial", () => {
  it("sem margem", () => expect(calculatePrudentialLimit(250_000, 0)).toBe(250_000));
  it("margem 5%", () => expect(calculatePrudentialLimit(250_000, 0.05)).toBe(237_500));
  it("margem 10%", () => expect(calculatePrudentialLimit(250_000, 0.1)).toBe(225_000));
  it("margem inválida limitada a 1", () => expect(calculatePrudentialLimit(250_000, 5)).toBe(0));
  it("excesso prudencial dentro do limite oficial", () =>
    expect(calculatePrudentialExcess(240_000, calculatePrudentialLimit(250_000, 0.1))).toBe(15_000));
});

describe("fgcCalculator - agregação por conglomerado", () => {
  it("mesmo conglomerado agrega", () => {
    const d = calculateFgcDiagnosis({
      assets: [makeAsset({ id: "a1", currentBalance: 200_000 }), makeAsset({ id: "a2", currentBalance: 100_000 })],
      ordinaryLimitRule: rule, prudentialMargin: 0, titularNames: { t1: "T" },
    });
    expect(d.rows.length).toBe(1);
    expect(d.rows[0].eligibleBalance).toBe(300_000);
    expect(d.rows[0].officialExcess).toBe(50_000);
  });
  it("conglomerados diferentes não somam", () => {
    const d = calculateFgcDiagnosis({
      assets: [
        makeAsset({ id: "a1", conglomerateKey: "cg-1", currentBalance: 200_000 }),
        makeAsset({ id: "a2", conglomerateKey: "cg-2", currentBalance: 200_000 }),
      ],
      ordinaryLimitRule: rule, prudentialMargin: 0, titularNames: { t1: "T" },
    });
    expect(d.rows.length).toBe(2);
    expect(d.totalOfficialExcess).toBe(0);
  });
  it("não coberto não entra em protegido", () => {
    const d = calculateFgcDiagnosis({
      assets: [makeAsset({ coverageStatus: "not_covered", currentBalance: 50_000 })],
      ordinaryLimitRule: rule, prudentialMargin: 0, titularNames: { t1: "T" },
    });
    expect(d.totalPotentiallyCovered).toBe(0);
    expect(d.totalNotCovered).toBe(50_000);
  });
  it("instituição não verificada vira unverified", () => {
    const d = calculateFgcDiagnosis({
      assets: [makeAsset({ institutionVerified: false, conglomerateVerified: false })],
      ordinaryLimitRule: rule, prudentialMargin: 0, titularNames: { t1: "T" },
    });
    expect(d.totalUnverified).toBe(100_000);
    expect(d.assetsPendingInstitution).toContain("a1");
  });
  it("needs_review vira pendente", () => {
    const d = calculateFgcDiagnosis({
      assets: [makeAsset({ coverageStatus: "needs_review" })],
      ordinaryLimitRule: rule, prudentialMargin: 0, titularNames: { t1: "T" },
    });
    expect(d.assetsPendingClassification.length).toBe(1);
  });
  it("groupExposureByConglomerate ignora não-cobertos", () => {
    const map = groupExposureByConglomerate([
      makeAsset({ id: "a1", currentBalance: 50_000 }),
      makeAsset({ id: "a2", currentBalance: 30_000, coverageStatus: "not_covered" }),
    ]);
    expect(map["cg-1"]).toBe(50_000);
  });
});

describe("fgcCalculator - titularidade", () => {
  it("individual = 100% ao titular", () =>
    expect(allocateJointOwnership(makeAsset({ currentBalance: 200_000 }), "t1")).toBe(200_000));
  it("conjunto 2 titulares = metade", () =>
    expect(allocateJointOwnership(makeAsset({ ownership: "joint", ownershipHolderCount: 2, currentBalance: 300_000 }), "t1")).toBe(150_000));
  it("ativo de outro titular = 0", () =>
    expect(allocateJointOwnership(makeAsset({ titularId: "t2" }), "t1")).toBe(0));
});

describe("fgcCalculator - janela 4 anos", () => {
  const agg = FGC_FALLBACK_RULES.aggregate.numericValue;
  it("histórico desconhecido", () => {
    const r = calculateFourYearUsage({ events: [], aggregateLimit: agg, windowYears: 4, historyDeclared: false });
    expect(r.status).toBe("unknown_history");
    expect(r.remaining).toBe(0);
  });
  it("declarado sem eventos", () => {
    const r = calculateFourYearUsage({ events: [], aggregateLimit: agg, windowYears: 4, historyDeclared: true });
    expect(r.status).toBe("no_events_declared");
    expect(r.remaining).toBe(agg);
  });
  it("um pagamento na janela", () => {
    const r = calculateFourYearUsage({
      events: [{ id: "e1", titularId: "t1", eventDate: new Date().toISOString(), guaranteedAmountReceived: 200_000 }],
      aggregateLimit: agg, windowYears: 4, historyDeclared: true,
    });
    expect(r.paymentsInWindow).toBe(200_000);
    expect(r.status).toBe("within_limit");
  });
  it("near_limit", () => {
    const r = calculateFourYearUsage({
      events: [{ id: "e1", titularId: "t1", eventDate: new Date().toISOString(), guaranteedAmountReceived: 950_000 }],
      aggregateLimit: agg, windowYears: 4, historyDeclared: true,
    });
    expect(r.status).toBe("near_limit");
  });
  it("possibly_exhausted", () => {
    const r = calculateFourYearUsage({
      events: [{ id: "e1", titularId: "t1", eventDate: new Date().toISOString(), guaranteedAmountReceived: 1_000_000 }],
      aggregateLimit: agg, windowYears: 4, historyDeclared: true,
    });
    expect(r.status).toBe("possibly_exhausted");
  });
  it("evento fora da janela é ignorado", () => {
    const old = new Date(); old.setFullYear(old.getFullYear() - 5);
    const r = calculateFourYearUsage({
      events: [{ id: "e1", titularId: "t1", eventDate: old.toISOString(), guaranteedAmountReceived: 500_000 }],
      aggregateLimit: agg, windowYears: 4, historyDeclared: true,
    });
    expect(r.paymentsInWindow).toBe(0);
  });
});

describe("fgcCalculator - projeção", () => {
  it("sem taxa retorna saldo atual", () => {
    const r = calculateProjectedFgcExposure({ currentBalance: 100_000, prudentialLimit: 225_000 });
    expect(r.projectedBalance).toBe(100_000);
  });
  it("projeta ultrapassagem", () => {
    const r = calculateProjectedFgcExposure({ currentBalance: 200_000, annualRate: 0.15, months: 36, prudentialLimit: 225_000 });
    expect(r.crossesPrudentialLimit).toBe(true);
    expect(r.monthsToCross).toBeGreaterThan(0);
  });
});