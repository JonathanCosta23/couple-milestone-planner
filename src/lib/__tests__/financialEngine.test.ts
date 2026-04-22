/**
 * financialEngine — testes de projeção (nominal, líquido, real).
 * Como `calculateProjection` é o ponto único de verdade que combina
 * `generateProjection` (engine bruta) + IR + inflação, esses cenários
 * cobrem o motor financeiro completo end-to-end.
 */
import { describe, it, expect } from "vitest";
import { calculateProjection } from "@/lib/services/projectionService";
import { generateProjection } from "@/lib/calculator";
import { makeConfig, NO_MONTH_RECORDS } from "@/test/helpers/factories";

describe("financialEngine — projeções", () => {
  const startDate = "2026-01";

  it("Nominal: cresce monotonicamente com aporte recorrente positivo", () => {
    const config = makeConfig({
      years: 5,
      initialAmount: 10_000,
      contributors: [{ name: "A", plannedSelic: 1_000, plannedCDB: 0 }],
    });
    const rows = generateProjection(config, "planned", NO_MONTH_RECORDS, startDate);
    expect(rows.length).toBe(60);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].totalBalance).toBeGreaterThan(rows[i - 1].totalBalance);
    }
  });

  it("Líquido: aplica IR sobre ganhos (líquido < nominal quando há juros)", () => {
    const config = makeConfig({
      years: 10,
      initialAmount: 10_000,
      contributors: [{ name: "A", plannedSelic: 500, plannedCDB: 0 }],
    });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, startDate, {
      inflationRate: 0.045,
      irRate: 0.15,
    });
    // Houve ganhos -> líquido tem que ser estritamente menor que nominal.
    expect(r.finalNominal).toBeGreaterThan(r.finalNet);
    // E o desconto deve ser próximo de 15% dos ganhos.
    const lastRow = r.nominal[r.nominal.length - 1];
    const gains = lastRow.balance - lastRow.deposited;
    const expectedNet = lastRow.balance - gains * 0.15;
    expect(r.finalNet).toBeCloseTo(expectedNet, 2);
  });

  it("Real: deflaciona pela inflação acumulada (real < líquido em horizonte longo)", () => {
    const config = makeConfig({
      years: 20,
      initialAmount: 5_000,
      contributors: [{ name: "A", plannedSelic: 800, plannedCDB: 0 }],
    });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, startDate, {
      inflationRate: 0.045,
      irRate: 0.15,
    });
    expect(r.finalNet).toBeGreaterThan(r.finalReal);
    // Em 20 anos a 4.5% a.a., o deflator nominal final é ~ (1.045)^20 ≈ 2.41,
    // então real deve ser bem menor que nominal.
    expect(r.finalReal).toBeLessThan(r.finalNominal / 2);
    expect(r.finalReal).toBeGreaterThan(0);
  });

  it("Sem aporte e sem saldo inicial: projeção zera (sanidade do motor)", () => {
    const config = makeConfig({
      years: 3,
      initialAmount: 0,
      contributors: [{ name: "A", plannedSelic: 0, plannedCDB: 0 }],
    });
    const r = calculateProjection(config, "planned", NO_MONTH_RECORDS, startDate);
    expect(r.finalNominal).toBe(0);
    expect(r.finalNet).toBe(0);
    expect(r.finalReal).toBe(0);
    expect(r.monthsToTargetNominal).toBeNull();
  });
});