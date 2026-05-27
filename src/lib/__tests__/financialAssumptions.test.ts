import { describe, it, expect } from "vitest";
import {
  DEFAULT_ASSUMPTIONS,
  SCENARIO_PRESETS,
  resolveAssumptions,
} from "@/lib/financialAssumptions";
import { calculateProjection } from "@/lib/services/projectionService";
import { makeConfig, NO_MONTH_RECORDS } from "@/test/helpers/factories";

describe("financialAssumptions", () => {
  it("usa defaults quando não há plano nem overrides", () => {
    expect(resolveAssumptions()).toEqual(DEFAULT_ASSUMPTIONS);
  });

  it("prioriza premissas do plano sobre defaults", () => {
    const r = resolveAssumptions({
      assumption_inflation: 0.07,
      assumption_ir: 0.225,
      assumption_selic: 0.12,
    });
    expect(r.inflationRate).toBe(0.07);
    expect(r.taxRate).toBe(0.225);
    expect(r.expectedReturnRate).toBe(0.12);
    // Não informado no plano cai no default.
    expect(r.withdrawalRate).toBe(DEFAULT_ASSUMPTIONS.withdrawalRate);
  });

  it("ignora valores não-finite vindos do plano", () => {
    const r = resolveAssumptions({
      assumption_inflation: null,
      assumption_ir: Number.NaN,
    });
    expect(r.inflationRate).toBe(DEFAULT_ASSUMPTIONS.inflationRate);
    expect(r.taxRate).toBe(DEFAULT_ASSUMPTIONS.taxRate);
  });

  it("overrides explícitos vencem plano e defaults", () => {
    const r = resolveAssumptions(
      { assumption_inflation: 0.05 },
      { inflationRate: 0.09, withdrawalRate: 0.035 },
    );
    expect(r.inflationRate).toBe(0.09);
    expect(r.withdrawalRate).toBe(0.035);
  });

  it("presets de cenário são monotônicos em inflação", () => {
    expect(SCENARIO_PRESETS.conservative.assumptions.inflationRate)
      .toBeGreaterThan(SCENARIO_PRESETS.base.assumptions.inflationRate);
    expect(SCENARIO_PRESETS.aggressive.assumptions.inflationRate)
      .toBeLessThan(SCENARIO_PRESETS.base.assumptions.inflationRate);
  });
});

describe("projectionService com premissas customizadas", () => {
  const config = makeConfig({
    years: 20,
    initialAmount: 10_000,
    targetAmount: 500_000,
    contributors: [{ name: "A", plannedSelic: 1_500, plannedCDB: 0 }],
  });

  it("expõe assumptionsUsed igual ao input resolvido", () => {
    const a = resolveAssumptions({ assumption_inflation: 0.06, assumption_ir: 0.2 });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, "2026-01", a);
    expect(r.assumptionsUsed.inflationRate).toBe(0.06);
    expect(r.assumptionsUsed.taxRate).toBe(0.2);
  });

  it("inflação maior reduz patrimônio real final", () => {
    const low = calculateProjection(config, "planned", NO_MONTH_RECORDS, "2026-01", {
      inflationRate: 0.03,
    });
    const high = calculateProjection(config, "planned", NO_MONTH_RECORDS, "2026-01", {
      inflationRate: 0.08,
    });
    expect(low.finalReal).toBeGreaterThan(high.finalReal);
    // Nominal não muda com inflação.
    expect(low.finalNominal).toBeCloseTo(high.finalNominal, 2);
  });

  it("withdrawalRate maior aumenta renda passiva estimada", () => {
    const conservative = calculateProjection(config, "planned", NO_MONTH_RECORDS, "2026-01", {
      withdrawalRate: 0.03,
    });
    const aggressive = calculateProjection(config, "planned", NO_MONTH_RECORDS, "2026-01", {
      withdrawalRate: 0.05,
    });
    expect(aggressive.estimatedPassiveIncome).toBeGreaterThan(conservative.estimatedPassiveIncome);
  });

  it("compat: aceita { irRate } legado e mapeia para taxRate", () => {
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, "2026-01", {
      irRate: 0.225,
    });
    expect(r.assumptionsUsed.taxRate).toBe(0.225);
  });
});
