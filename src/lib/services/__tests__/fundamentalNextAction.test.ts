import { describe, it, expect } from "vitest";
import { computeFundamentalNextAction } from "@/lib/services/fundamentalNextAction";
import type { CoreMetrics } from "@/lib/services/metricsService";

const baseMetrics = (over: Partial<CoreMetrics> = {}): CoreMetrics => ({
  totalIncome: 10000, totalExpenses: 6000, essentialExpenses: 4000, nonEssentialExpenses: 2000,
  fixedExpenses: 4000, variableExpenses: 2000, totalDebtPayment: 0, totalDebtBalance: 0,
  debtWeight: 0, toxicDebtCount: 0, savingsRate: 0.2, investmentRate: 0.1, monthlyContribution: 1000,
  reserveLiquid: 24000, reserveMonths: 6, reserveGoal: 24000, reserveGoalMonths: 6, reserveStatus: "complete",
  grossWealth: 30000, totalDebtBalanceForNetWorth: 0, netWealth: 30000,
  protectedRatio: 0.8, sovereignRatio: 0.4, liquidityRatio: 0.8,
  maxConcentrationByAsset: 0.3, maxConcentrationByInstitution: 0.4, concentrationInstitution: "",
  streak: 3, completionRate12m: 0.8, cardDependency: 0.1, isCouple: false, contributorCount: 1,
  ...over,
});

describe("fundamentalNextAction · prioridades", () => {
  it("dívida cara vem antes de tudo", () => {
    const a = computeFundamentalNextAction({ metrics: baseMetrics({ toxicDebtCount: 1 }), hasBudgetData: false, reserveMonths: 0 });
    expect(a.kind).toBe("expensive_debt");
    expect(a.ctaTarget.tab).toBe("execucao");
  });
  it("orçamento sem dados quando não há dívida cara", () => {
    const a = computeFundamentalNextAction({ metrics: baseMetrics(), hasBudgetData: false, reserveMonths: 6 });
    expect(a.kind).toBe("budget_incomplete");
  });
  it("reserva insuficiente quando há orçamento mas faltam meses", () => {
    const a = computeFundamentalNextAction({ metrics: baseMetrics(), hasBudgetData: true, reserveMonths: 2, reserveTargetMonths: 6 });
    expect(a.kind).toBe("reserve_insufficient");
  });
  it("plano patrimonial quando reserva ok e aporte baixo", () => {
    const a = computeFundamentalNextAction({
      metrics: baseMetrics({ investmentRate: 0.02, savingsRate: 0.2 }),
      hasBudgetData: true, reserveMonths: 6,
    });
    expect(a.kind).toBe("wealth_plan_review");
  });
  it("keep_going quando tudo está coerente", () => {
    const a = computeFundamentalNextAction({ metrics: baseMetrics(), hasBudgetData: true, reserveMonths: 6 });
    expect(a.kind).toBe("keep_going");
  });
  it("nenhum texto usa termos proibidos", () => {
    const forbidden = ["retorno garantido", "aposentadoria garantida", "renda garantida", "liberdade financeira assegurada"];
    for (const kindCtx of [
      { metrics: baseMetrics({ toxicDebtCount: 2 }), hasBudgetData: false, reserveMonths: 0 },
      { metrics: baseMetrics(), hasBudgetData: false, reserveMonths: 0 },
      { metrics: baseMetrics(), hasBudgetData: true, reserveMonths: 1 },
      { metrics: baseMetrics({ investmentRate: 0 }), hasBudgetData: true, reserveMonths: 6 },
      { metrics: baseMetrics(), hasBudgetData: true, reserveMonths: 6 },
    ]) {
      const a = computeFundamentalNextAction(kindCtx);
      const text = `${a.headline} ${a.detail}`.toLowerCase();
      for (const t of forbidden) expect(text).not.toContain(t);
    }
  });
});