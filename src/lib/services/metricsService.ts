/**
 * metricsService — Single source of truth for all derived financial metrics.
 * Every screen MUST read metrics from here. No screen recalculates independently.
 */

import type { AppData } from "@/lib/models";
import type { PlanConfig, MonthRecord, FinancialProfile } from "@/lib/types";
import { getCurrentMonthKey } from "@/lib/types";
import { calculateStreak } from "@/lib/calculator";

export interface CoreMetrics {
  // Income & Expenses
  totalIncome: number;
  totalExpenses: number;
  essentialExpenses: number;
  nonEssentialExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;

  // Debt
  totalDebtPayment: number;
  totalDebtBalance: number;
  debtWeight: number; // debtPayment / income
  toxicDebtCount: number;

  // Savings & Investment
  savingsRate: number;
  investmentRate: number;
  monthlyContribution: number;

  // Emergency Fund
  reserveLiquid: number; // liquid assets for emergency
  reserveMonths: number;
  reserveGoal: number;
  reserveGoalMonths: number;
  reserveStatus: "empty" | "building" | "partial" | "complete";

  // Net Worth
  grossWealth: number; // all assets
  totalDebtBalanceForNetWorth: number;
  netWealth: number; // assets - debts

  // Allocation & Protection
  protectedRatio: number; // FGC + sovereign / total
  sovereignRatio: number;
  liquidityRatio: number; // daily liquidity / total
  maxConcentrationByAsset: number;
  maxConcentrationByInstitution: number;
  concentrationInstitution: string;

  // Discipline
  streak: number;
  completionRate12m: number;

  // Card
  cardDependency: number;

  // Mode
  isCouple: boolean;
  contributorCount: number;
}

export function calculateCoreMetrics(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string,
  profile?: FinancialProfile
): CoreMetrics {
  const currentKey = getCurrentMonthKey();
  const isCouple = config.contributors.length > 1;

  // ── Income ──
  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);

  // ── Expenses ──
  const monthExp = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExp.reduce((s, e) => s + e.amount, 0);
  const essentialExpenses = monthExp.filter(e => e.priority === "essential").reduce((s, e) => s + e.amount, 0);
  const nonEssentialExpenses = totalExpenses - essentialExpenses;
  const fixedExpenses = monthExp.filter(e => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
  const variableExpenses = monthExp.filter(e => e.type === "variable").reduce((s, e) => s + e.amount, 0);

  // ── Debts ──
  const activeDebts = appData.debts.filter(d => d.active);
  const totalDebtPayment = activeDebts.reduce((s, d) => s + d.monthlyPayment, 0);
  const totalDebtBalance = activeDebts.reduce((s, d) => s + d.totalAmount, 0);
  const debtWeight = totalIncome > 0 ? totalDebtPayment / totalIncome : 0;
  const toxicDebtCount = activeDebts.filter(d => d.risk === "toxic" || d.risk === "high").length;

  // ── Contributions ──
  const monthlyContribution = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses - totalDebtPayment) / totalIncome : 0;
  const investmentRate = totalIncome > 0 ? monthlyContribution / totalIncome : 0;

  // ── Investments ──
  const activeInvestments = appData.investments.filter(i => i.active);
  const grossWealth = activeInvestments.reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;
  const netWealth = grossWealth - totalDebtBalance;

  // ── Emergency Reserve ──
  const expenseEstimate = profile?.monthlyExpenses
    ? profile.monthlyExpenses
    : totalExpenses > 0
      ? totalExpenses
      : totalIncome > 0
        ? totalIncome * 0.6
        : 0;
  const reserveGoalMonths = 6;
  const reserveGoal = expenseEstimate * reserveGoalMonths;
  const reserveLiquid = activeInvestments
    .filter(i => ["tesouro-selic", "poupanca"].includes(i.type))
    .reduce((s, i) => s + i.currentBalance, 0)
    + (profile?.emergencyFund || 0);
  const reserveMonths = expenseEstimate > 0 ? reserveLiquid / expenseEstimate : 0;
  const reserveStatus: CoreMetrics["reserveStatus"] =
    reserveMonths >= 6 ? "complete"
      : reserveMonths >= 3 ? "partial"
        : reserveMonths > 0 ? "building"
          : "empty";

  // ── Allocation ──
  const fgcAssets = activeInvestments
    .filter(i => ["cdb", "lci-lca", "poupanca"].includes(i.type))
    .reduce((s, i) => s + i.currentBalance, 0);
  const sovereignAssets = activeInvestments
    .filter(i => i.type === "tesouro-selic")
    .reduce((s, i) => s + i.currentBalance, 0);
  const dailyLiquidity = activeInvestments
    .filter(i => ["tesouro-selic", "poupanca"].includes(i.type))
    .reduce((s, i) => s + i.currentBalance, 0);

  const protectedRatio = grossWealth > 0 ? (fgcAssets + sovereignAssets) / grossWealth : 0;
  const sovereignRatio = grossWealth > 0 ? sovereignAssets / grossWealth : 0;
  const liquidityRatio = grossWealth > 0 ? dailyLiquidity / grossWealth : 0;

  // ── Concentration ──
  const byInstitution = new Map<string, number>();
  const byAsset = new Map<string, number>();
  activeInvestments.forEach(i => {
    byInstitution.set(i.institution, (byInstitution.get(i.institution) || 0) + i.currentBalance);
    const key = `${i.type}-${i.institution}`;
    byAsset.set(key, (byAsset.get(key) || 0) + i.currentBalance);
  });
  const totalForConcentration = activeInvestments.reduce((s, i) => s + i.currentBalance, 0);
  const maxConcentrationByInstitution = totalForConcentration > 0 && byInstitution.size > 0
    ? Math.max(...byInstitution.values()) / totalForConcentration : 0;
  const maxConcentrationByAsset = totalForConcentration > 0 && byAsset.size > 0
    ? Math.max(...byAsset.values()) / totalForConcentration : 0;

  let concentrationInstitution = "";
  if (byInstitution.size > 0) {
    let maxVal = 0;
    byInstitution.forEach((val, key) => {
      if (val > maxVal) { maxVal = val; concentrationInstitution = key; }
    });
  }

  // ── Discipline ──
  const streak = calculateStreak(config, monthRecords, startDate);
  const allKeys = getAllPastMonthKeys(startDate, config.years * 12);
  const last12 = allKeys.slice(-12);
  const completedLast12 = last12.filter(k => {
    const rec = monthRecords.find(r => r.monthKey === k);
    return rec?.completed || false;
  }).length;
  const completionRate12m = last12.length > 0 ? completedLast12 / last12.length : 0;

  // ── Card ──
  const cardExp = monthExp.filter(e => e.category === "cartao").reduce((s, e) => s + e.amount, 0);
  const cardDependency = totalExpenses > 0 ? cardExp / totalExpenses : 0;

  return {
    totalIncome,
    totalExpenses,
    essentialExpenses,
    nonEssentialExpenses,
    fixedExpenses,
    variableExpenses,
    totalDebtPayment,
    totalDebtBalance,
    debtWeight,
    toxicDebtCount,
    savingsRate,
    investmentRate,
    monthlyContribution,
    reserveLiquid,
    reserveMonths,
    reserveGoal,
    reserveGoalMonths,
    reserveStatus,
    grossWealth,
    totalDebtBalanceForNetWorth: totalDebtBalance,
    netWealth,
    protectedRatio,
    sovereignRatio,
    liquidityRatio,
    maxConcentrationByAsset,
    maxConcentrationByInstitution,
    concentrationInstitution,
    streak,
    completionRate12m,
    cardDependency,
    isCouple,
    contributorCount: config.contributors.length,
  };
}

function getAllPastMonthKeys(startDate: string, totalMonths: number): string[] {
  const currentKey = getCurrentMonthKey();
  const [sy, sm] = startDate.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const m = ((sm - 1 + i) % 12) + 1;
    const y = sy + Math.floor((sm - 1 + i) / 12);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key <= currentKey) keys.push(key);
    else break;
  }
  return keys;
}
