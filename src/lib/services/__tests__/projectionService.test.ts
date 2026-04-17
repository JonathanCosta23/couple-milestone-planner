/**
 * Cobre a regra central da "Verdade Financeira":
 * Nominal >= Líquido >= Real, e cenários ajustam tempo até a meta corretamente.
 */
import { describe, it, expect } from "vitest";
import { calculateProjection } from "@/lib/services/projectionService";
import { makeConfig, NO_MONTH_RECORDS } from "@/test/helpers/factories";

describe("projectionService", () => {
  const startDate = "2026-01";

  it("Cenário 1 (aporte alto, prazo curto): nominal > líquido > real ao final", () => {
    const config = makeConfig({
      years: 10,
      initialAmount: 50_000,
      targetAmount: 500_000,
      contributors: [{ name: "A", plannedSelic: 3_000, plannedCDB: 0 }],
    });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, startDate, {
      inflationRate: 0.045,
      irRate: 0.15,
    });

    expect(r.nominal.length).toBe(120);
    expect(r.finalNominal).toBeGreaterThan(r.finalNet);
    expect(r.finalNet).toBeGreaterThan(r.finalReal);
    expect(r.finalReal).toBeGreaterThan(0);
  });

  it("Cenário 2 (aporte baixo, alvo alto): pode não atingir nominalmente em 5 anos", () => {
    const config = makeConfig({
      years: 5,
      initialAmount: 1_000,
      targetAmount: 1_000_000,
      contributors: [{ name: "A", plannedSelic: 200, plannedCDB: 0 }],
    });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, startDate);
    expect(r.monthsToTargetNominal).toBeNull();
    expect(r.monthsToTargetReal).toBeNull();
  });

  it("Cenário 3: tempo até a meta nominal <= líquido <= real (real é o mais difícil)", () => {
    const config = makeConfig({
      years: 30,
      initialAmount: 10_000,
      targetAmount: 250_000,
      contributors: [{ name: "A", plannedSelic: 1_500, plannedCDB: 0 }],
    });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, startDate);
    expect(r.monthsToTargetNominal).not.toBeNull();
    if (r.monthsToTargetNominal && r.monthsToTargetNet) {
      expect(r.monthsToTargetNominal).toBeLessThanOrEqual(r.monthsToTargetNet);
    }
    if (r.monthsToTargetNet && r.monthsToTargetReal) {
      expect(r.monthsToTargetNet).toBeLessThanOrEqual(r.monthsToTargetReal);
    }
  });

  it("Renda passiva estimada usa regra dos 4% sobre patrimônio líquido", () => {
    const config = makeConfig({
      years: 10,
      initialAmount: 100_000,
      targetAmount: 500_000,
      contributors: [{ name: "A", plannedSelic: 2_000, plannedCDB: 0 }],
    });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, startDate);
    const expected = (r.finalNet * 0.04) / 12;
    expect(r.estimatedPassiveIncome).toBeCloseTo(expected, 2);
  });
});
