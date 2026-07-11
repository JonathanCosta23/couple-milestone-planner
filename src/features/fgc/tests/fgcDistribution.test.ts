import { describe, it, expect } from "vitest";
import { buildGenericDistributionScenario, calculateMinimumConglomerates } from "../services/fgcDistribution";
import { FGC_DISCLAIMER_DISTRIBUTION, FGC_DISCLAIMER_MARGIN } from "../types/fgc";

const officialLimit = 250_000;

describe("fgcDistribution - minimo de conglomerados", () => {
  it("R$ 200 mil sem margem = 1", () => expect(calculateMinimumConglomerates(200_000, 250_000)).toBe(1));
  it("R$ 250 mil sem margem = 1", () => expect(calculateMinimumConglomerates(250_000, 250_000)).toBe(1));
  it("R$ 500 mil sem margem = 2", () => expect(calculateMinimumConglomerates(500_000, 250_000)).toBe(2));
  it("R$ 1 milhao sem margem = 4", () => expect(calculateMinimumConglomerates(1_000_000, 250_000)).toBe(4));
  it("R$ 1 milhao com margem 10% = 5", () => expect(calculateMinimumConglomerates(1_000_000, 225_000)).toBe(5));
});

describe("fgcDistribution - cenario generico", () => {
  it("nao recomenda instituicao pelo nome", () => {
    const r = buildGenericDistributionScenario({ totalToDistribute: 500_000, prudentialMargin: 0, officialLimit });
    r.allocations.forEach(a =>
      expect(a.conglomerateLabel.toLowerCase()).not.toMatch(/nubank|itau|bradesco|santander|caixa|banco do brasil/));
  });
  it("disclaimers obrigatorios presentes", () => {
    const r = buildGenericDistributionScenario({ totalToDistribute: 500_000, prudentialMargin: 0.05, officialLimit });
    expect(r.disclaimers).toContain(FGC_DISCLAIMER_DISTRIBUTION);
    expect(r.disclaimers).toContain(FGC_DISCLAIMER_MARGIN);
  });
  it("nenhuma frase promete risco zero", () => {
    const r = buildGenericDistributionScenario({ totalToDistribute: 500_000, prudentialMargin: 0, officialLimit });
    const joined = JSON.stringify(r).toLowerCase();
    expect(joined).not.toMatch(/risco zero|totalmente seguro|sem risco|100% seguro|nunca perder/);
  });
  it("alocacao preenche conglomerados existentes primeiro", () => {
    const r = buildGenericDistributionScenario({
      totalToDistribute: 400_000, prudentialMargin: 0, officialLimit,
      existingExposureByConglomerate: { MinhaConta: 100_000 },
    });
    expect(r.allocations[0].conglomerateLabel).toBe("MinhaConta");
    expect(r.allocations[0].amount).toBe(150_000);
  });
  it("total zero retorna vazio", () => {
    const r = buildGenericDistributionScenario({ totalToDistribute: 0, prudentialMargin: 0, officialLimit });
    expect(r.allocations.length).toBe(0);
  });
});