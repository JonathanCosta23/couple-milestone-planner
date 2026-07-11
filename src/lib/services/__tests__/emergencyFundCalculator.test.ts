import { describe, it, expect } from "vitest";
import {
  calculateEmergencyFund,
  calculateEmergencyFundGap,
  calculateEmergencyFundMonths,
  calculateEmergencyFundTarget,
  computeEligibleReserve,
  suggestEmergencyFundRange,
} from "@/lib/services/emergencyFundCalculator";

describe("emergencyFundCalculator · reserva", () => {
  it("despesas essenciais × meses (3/6/9/12)", () => {
    for (const m of [3, 6, 9, 12] as const) {
      expect(calculateEmergencyFundTarget(2000, m)).toBe(2000 * m);
    }
  });

  it("cenário personalizado usa o número escolhido", () => {
    const r = calculateEmergencyFund({ essentialMonthlyExpenses: 3000, months: 8, currentEligibleReserve: 5000 });
    expect(r.target).toBe(24000);
    expect(r.months).toBe(8);
  });

  it("gap nunca fica negativo quando reserva excede a meta", () => {
    const r = calculateEmergencyFund({ essentialMonthlyExpenses: 1000, months: 6, currentEligibleReserve: 20000 });
    expect(r.gap).toBe(0);
    expect(r.progressPercentage).toBe(100);
  });

  it("calculateEmergencyFundGap trata inválidos", () => {
    expect(calculateEmergencyFundGap(6000, 2000)).toBe(4000);
    expect(calculateEmergencyFundGap(6000, 7000)).toBe(0);
  });

  it("calculateEmergencyFundMonths não divide por zero", () => {
    expect(calculateEmergencyFundMonths(5000, 0)).toBe(0);
    expect(calculateEmergencyFundMonths(6000, 2000)).toBe(3);
  });

  it("estados educacionais não usam 'totalmente protegido'", () => {
    const r = calculateEmergencyFund({ essentialMonthlyExpenses: 2000, months: 6, currentEligibleReserve: 30000 });
    expect(r.state).toBe("extended_complete");
    // resultado nunca deve declarar segurança absoluta
    expect(JSON.stringify(r)).not.toMatch(/totalmente protegido|protegido totalmente/i);
  });

  it("ativos ilíquidos e voláteis não entram como reserva", () => {
    const e = computeEligibleReserve([
      { type: "tesouro-selic", currentBalance: 5000, active: true },
      { type: "acoes", currentBalance: 10000, active: true },
      { type: "fii", currentBalance: 8000, active: true },
      { type: "imovel", currentBalance: 300000, active: true },
      { type: "cripto", currentBalance: 2000, active: true },
    ]);
    expect(e.eligibleTotal).toBe(5000);
    expect(e.ineligibleTotal).toBe(320000);
  });

  it("ativos com vencimento distante não entram", () => {
    const far = new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString();
    const e = computeEligibleReserve([{ type: "cdb", currentBalance: 10000, maturityDate: far, active: true }]);
    expect(e.eligibleTotal).toBe(0);
    expect(e.ineligibleTotal).toBe(10000);
  });

  it("ativos sem classificação viram unclassified, não elegíveis", () => {
    const e = computeEligibleReserve([{ type: "outro", currentBalance: 5000, active: true }]);
    expect(e.eligibleTotal).toBe(0);
    expect(e.unclassifiedTotal).toBe(5000);
    expect(e.hasUnclassified).toBe(true);
  });

  it("renda variável e muitos dependentes empurram a faixa para cima", () => {
    const stable = suggestEmergencyFundRange({
      incomeType: "clt", dependents: 0, hasSecondIncome: false,
      incomeVariesSignificantly: false, hasRelevantInsurance: false,
      hasRecurringMedicalExpenses: false, hasShortTermDebt: false,
      estimatedMonthsToRecoverIncome: 2,
    });
    const risky = suggestEmergencyFundRange({
      incomeType: "autonomo", dependents: 3, hasSecondIncome: false,
      incomeVariesSignificantly: true, hasRelevantInsurance: false,
      hasRecurringMedicalExpenses: false, hasShortTermDebt: false,
      estimatedMonthsToRecoverIncome: 4,
    });
    expect(risky.maxMonths).toBeGreaterThan(stable.maxMonths);
    expect(risky.minMonths).toBeGreaterThanOrEqual(stable.minMonths);
  });

  it("essenciais zerados retornam insufficient_data", () => {
    const r = calculateEmergencyFund({ essentialMonthlyExpenses: 0, months: 6, currentEligibleReserve: 5000 });
    expect(r.state).toBe("insufficient_data");
  });
});