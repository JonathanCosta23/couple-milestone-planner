import { describe, it, expect } from "vitest";
import { computeNextBestAction, runNextActionEngine, hasForbiddenLanguage } from "../services/nextActionEngine";
import type { NextActionContext, UserActionState } from "../types/nextAction";

function baseCtx(over: Partial<NextActionContext> = {}): NextActionContext {
  return {
    now: new Date("2026-07-15T12:00:00Z"),
    planId: "plan-1",
    hasCoreDataLoaded: true,
    metrics: {
      totalIncome: 10000, totalExpenses: 6000, essentialExpenses: 4000,
      savingsRate: 0.2, monthlyContribution: 1000,
      reserveMonths: 6, reserveGoalMonths: 6, reserveGap: 0,
      grossWealth: 50000, toxicDebtCount: 0, debtWeight: 0,
      maxConcentrationByInstitution: 0.3, concentrationInstitution: "",
    },
    hasBudgetData: true,
    hasIncomeData: true,
    hasExpenseData: true,
    debts: [],
    currentMonthKey: "2026-07",
    currentMonthPlanned: 0,
    currentMonthActual: 0,
    currentMonthCompleted: false,
    learningLevel: "basic",
    storedStates: new Map(),
    ...over,
  };
}

describe("nextActionEngine · hierarquia", () => {
  it("dados não carregados vence tudo", () => {
    const a = computeNextBestAction(baseCtx({ hasCoreDataLoaded: false }));
    expect(a?.category).toBe("data_quality");
  });

  it("dívida cara supera reserva insuficiente", () => {
    const a = computeNextBestAction(baseCtx({
      metrics: { ...baseCtx().metrics, reserveMonths: 1, reserveGap: 20000, toxicDebtCount: 1 },
      debts: [{ id: "d1", label: "Cartão", monthlyPayment: 500, risk: "toxic", active: true, interestRateAnnual: 200 }],
    }));
    expect(a?.category).toBe("debt");
  });

  it("reserva insuficiente supera execução mensal", () => {
    const a = computeNextBestAction(baseCtx({
      metrics: { ...baseCtx().metrics, reserveMonths: 1, reserveGap: 20000 },
      currentMonthPlanned: 500,
    }));
    expect(a?.category).toBe("emergency_fund");
  });

  it("orçamento incompleto pede coleta em vez de conclusão", () => {
    const a = computeNextBestAction(baseCtx({ hasIncomeData: false, hasExpenseData: false, hasBudgetData: false }));
    expect(a?.category).toBe("budget");
    expect(a?.confidence).toBe("insufficient_data");
  });

  it("sem pendência retorna revisão / celebração sóbria", () => {
    const a = computeNextBestAction(baseCtx());
    expect(["review", "learning"]).toContain(a?.category);
  });
});

describe("nextActionEngine · determinismo", () => {
  it("mesma entrada = mesma ação", () => {
    const ctx = baseCtx({
      debts: [
        { id: "b", label: "B", monthlyPayment: 200, risk: "high", active: true, interestRateAnnual: 100 },
        { id: "a", label: "A", monthlyPayment: 100, risk: "high", active: true, interestRateAnnual: 80 },
      ],
    });
    const a1 = computeNextBestAction(ctx);
    const a2 = computeNextBestAction(ctx);
    expect(a1?.actionKey).toBe(a2?.actionKey);
  });

  it("versão do motor fica registrada", () => {
    const a = computeNextBestAction(baseCtx({ hasCoreDataLoaded: false }));
    expect(a?.engineVersion).toBe("nba-v1");
  });
});

describe("nextActionEngine · estado do usuário", () => {
  it("ação dispensada não é escolhida", () => {
    const stored = new Map<string, UserActionState>();
    stored.set("budget:missing_income", { actionKey: "budget:missing_income", status: "dismissed" });
    const a = computeNextBestAction(baseCtx({ hasIncomeData: false, hasBudgetData: false, storedStates: stored }));
    expect(a?.actionKey).not.toBe("budget:missing_income");
  });

  it("ação adiada volta após snoozed_until", () => {
    const past = new Date("2020-01-01").toISOString();
    const stored = new Map<string, UserActionState>();
    stored.set("budget:missing_income", {
      actionKey: "budget:missing_income",
      status: "snoozed",
      snoozedUntil: past,
    });
    const a = computeNextBestAction(baseCtx({ hasIncomeData: false, hasBudgetData: false, storedStates: stored }));
    expect(a?.actionKey).toBe("budget:missing_income");
  });

  it("ação concluída desaparece", () => {
    const stored = new Map<string, UserActionState>();
    stored.set("reserve:gap:plan-1", { actionKey: "reserve:gap:plan-1", status: "completed" });
    const a = computeNextBestAction(baseCtx({
      metrics: { ...baseCtx().metrics, reserveMonths: 1, reserveGap: 5000 },
      storedStates: stored,
    }));
    expect(a?.category).not.toBe("emergency_fund");
  });
});

describe("nextActionEngine · compliance", () => {
  it("nenhuma cópia usa termos proibidos", () => {
    const cases = [
      baseCtx({ hasCoreDataLoaded: false }),
      baseCtx({ debts: [{ id: "d", label: "Cartão", monthlyPayment: 100, risk: "toxic", active: true, interestRateAnnual: 300 }] }),
      baseCtx({ hasIncomeData: false, hasBudgetData: false }),
      baseCtx({ metrics: { ...baseCtx().metrics, reserveMonths: 0, reserveGap: 12000 } }),
      baseCtx({ metrics: { ...baseCtx().metrics, maxConcentrationByInstitution: 0.9, concentrationInstitution: "Banco X", grossWealth: 100000 } }),
      baseCtx(),
    ];
    for (const c of cases) {
      const r = runNextActionEngine(c);
      for (const a of r.all) {
        const text = `${a.title} ${a.description} ${a.reason} ${a.riskIfIgnored} ${a.ctaLabel}`;
        expect(hasForbiddenLanguage(text)).toBe(false);
      }
    }
  });

  it("ação secundária, quando existe, é de outra categoria", () => {
    const r = runNextActionEngine(baseCtx({
      debts: [{ id: "d1", label: "Cartão", monthlyPayment: 400, risk: "toxic", active: true, interestRateAnnual: 200 }],
      metrics: { ...baseCtx().metrics, reserveMonths: 0, reserveGap: 15000 },
    }));
    if (r.secondary && r.primary) {
      expect(r.secondary.category).not.toBe(r.primary.category);
    }
  });
});