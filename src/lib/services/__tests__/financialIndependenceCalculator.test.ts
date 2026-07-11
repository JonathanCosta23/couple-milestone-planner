import { describe, it, expect } from "vitest";
import {
  calculateFinancialIndependenceTarget,
  calculateReferenceMonthlyIncome,
  compareWithdrawalScenarios,
  FI_DISCLAIMER,
} from "@/lib/services/financialIndependenceCalculator";

describe("financialIndependenceCalculator · 200/250/333", () => {
  it("renda × 200 (0,5% ao mês)", () => {
    expect(calculateFinancialIndependenceTarget(5000, 0.005)).toBe(1_000_000);
  });
  it("renda × 250 (0,4% ao mês)", () => {
    expect(calculateFinancialIndependenceTarget(5000, 0.004)).toBe(1_250_000);
  });
  it("renda × 333 (0,3% ao mês)", () => {
    expect(Math.round(calculateFinancialIndependenceTarget(5000, 0.003))).toBe(1_666_667);
  });
  it("taxa personalizada respeita a fórmula", () => {
    expect(calculateFinancialIndependenceTarget(4000, 0.0025)).toBe(1_600_000);
  });
  it("taxa zero devolve Infinity (não divide por zero)", () => {
    expect(calculateFinancialIndependenceTarget(1000, 0)).toBe(Infinity);
  });
  it("taxa negativa é tratada como inválida", () => {
    expect(calculateFinancialIndependenceTarget(1000, -0.01)).toBe(Infinity);
  });
  it("renda de referência baseada no patrimônio atual", () => {
    expect(calculateReferenceMonthlyIncome(1_000_000, 0.004)).toBe(4000);
    expect(calculateReferenceMonthlyIncome(0, 0.004)).toBe(0);
  });
  it("compara cenários e ordena por taxa", () => {
    const r = compareWithdrawalScenarios({ desiredMonthlyIncome: 5000, currentWealth: 200_000 });
    expect(r.scenarios.map(s => s.key)).toEqual(["cons_333", "int_250", "simple_200"]);
    const t333 = r.scenarios[0].targetWealth;
    const t250 = r.scenarios[1].targetWealth;
    const t200 = r.scenarios[2].targetWealth;
    expect(t333).toBeGreaterThan(t250);
    expect(t250).toBeGreaterThan(t200);
  });
  it("patrimônio atual acima do cenário zera o gap", () => {
    const r = compareWithdrawalScenarios({ desiredMonthlyIncome: 1000, currentWealth: 500_000 });
    for (const s of r.scenarios) {
      expect(s.gap).toBe(0);
      expect(s.percentAchieved).toBe(100);
    }
  });
  it("patrimônio abaixo mostra gap positivo", () => {
    const r = compareWithdrawalScenarios({ desiredMonthlyIncome: 5000, currentWealth: 100_000 });
    for (const s of r.scenarios) expect(s.gap).toBeGreaterThan(0);
  });
  it("cenário custom entra na lista quando fornecido", () => {
    const r = compareWithdrawalScenarios({ desiredMonthlyIncome: 3000, currentWealth: 0, customMonthlyRate: 0.0035 });
    expect(r.scenarios.some(s => s.key === "custom")).toBe(true);
  });
  it("disclaimer não usa termos proibidos", () => {
    for (const term of ["renda garantida", "aposentadoria garantida", "retorno seguro"]) {
      expect(FI_DISCLAIMER.toLowerCase()).not.toContain(term);
    }
  });
  it("memória de cálculo usa os mesmos valores da interface", () => {
    const r = compareWithdrawalScenarios({ desiredMonthlyIncome: 5000, currentWealth: 200_000 });
    // recalcula manualmente e compara
    const manual = 5000 / 0.004;
    const scenario = r.scenarios.find(s => s.key === "int_250")!;
    expect(scenario.targetWealth).toBe(manual);
  });
});