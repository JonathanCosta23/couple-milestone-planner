import { describe, it, expect } from "vitest";
import {
  calculateBudgetDistribution,
  classifyBudgetDistribution,
  calculateSavingsRate,
  DEFAULT_BUDGET_PERCENTS,
} from "@/lib/services/budgetCalculator";

describe("budgetCalculator · 50-30-20", () => {
  it("aplica os percentuais padrão sobre a renda líquida", () => {
    const r = calculateBudgetDistribution({
      netIncome: 10000, essentialExpenses: 5000, nonEssentialExpenses: 3000,
      debtPayments: 0, contributions: 2000,
    });
    expect(r.needs.reference).toBe(5000);
    expect(r.wants.reference).toBe(3000);
    expect(r.wealth.reference).toBe(2000);
    expect(r.savingsRate).toBeCloseTo(0.2);
  });

  it("aceita percentuais personalizados", () => {
    const r = calculateBudgetDistribution({
      netIncome: 10000, essentialExpenses: 6000, nonEssentialExpenses: 2000,
      debtPayments: 500, contributions: 1500, percents: { needs: 0.6, wants: 0.2, wealth: 0.2 },
    });
    expect(r.needs.reference).toBe(6000);
    expect(r.percents.needs).toBe(0.6);
  });

  it("renda zero devolve resultado inválido sem dividir por zero", () => {
    const r = calculateBudgetDistribution({ netIncome: 0, essentialExpenses: 500, nonEssentialExpenses: 0, debtPayments: 0, contributions: 0 });
    expect(r.valid).toBe(false);
    expect(r.savingsRate).toBe(0);
    expect(r.needs.percentOfIncome).toBe(0);
  });

  it("renda negativa ou inválida é tratada como zero", () => {
    const r = calculateBudgetDistribution({ netIncome: -100, essentialExpenses: 0, nonEssentialExpenses: 0, debtPayments: 0, contributions: 0 });
    expect(r.valid).toBe(false);
  });

  it("marca despesas acima da renda", () => {
    const r = calculateBudgetDistribution({ netIncome: 5000, essentialExpenses: 4000, nonEssentialExpenses: 2000, debtPayments: 500, contributions: 0 });
    expect(r.hasExpensesOverIncome).toBe(true);
    const c = classifyBudgetDistribution(r);
    expect(c.headline).toMatch(/pressionada/i);
  });

  it("dívidas não são contabilizadas em construção patrimonial", () => {
    const r = calculateBudgetDistribution({ netIncome: 10000, essentialExpenses: 5000, nonEssentialExpenses: 3000, debtPayments: 800, contributions: 200 });
    expect(r.wealth.actual).toBe(200);
    expect(r.debts.actual).toBe(800);
  });

  it("ausência parcial de dados gera state incomplete_data", () => {
    const r = calculateBudgetDistribution({ netIncome: 5000, essentialExpenses: 0, nonEssentialExpenses: 0, debtPayments: 0, contributions: 0 });
    expect(r.hasIncompleteData).toBe(true);
    expect(r.needs.state).toBe("incomplete_data");
  });

  it("estrutura rígida quando essenciais >> referência", () => {
    const r = calculateBudgetDistribution({ netIncome: 5000, essentialExpenses: 4000, nonEssentialExpenses: 500, debtPayments: 0, contributions: 100 });
    expect(r.needs.state).toBe("rigid_structure");
  });

  it("classifyBudgetDistribution nunca usa vermelho/culpa", () => {
    const r = calculateBudgetDistribution({ netIncome: 5000, essentialExpenses: 2500, nonEssentialExpenses: 1500, debtPayments: 0, contributions: 500 });
    const c = classifyBudgetDistribution(r);
    expect(c.detail).not.toMatch(/culpa|errado|péssim/i);
  });

  it("calculateSavingsRate segura entradas inválidas", () => {
    expect(calculateSavingsRate(0, 100, 50)).toBe(0);
    expect(calculateSavingsRate(10000, 6000, 1000)).toBeCloseTo(0.3);
    expect(calculateSavingsRate(-10, 5, 5)).toBe(0);
  });

  it("percentuais default são 50/30/20", () => {
    expect(DEFAULT_BUDGET_PERCENTS).toEqual({ needs: 0.5, wants: 0.3, wealth: 0.2 });
  });
});