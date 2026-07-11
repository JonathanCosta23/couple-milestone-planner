/**
 * budgetCalculator — Diagnóstico educacional 50-30-20.
 * Funções puras. Nunca recomenda compra/venda/quitação.
 */

export interface BudgetPercents {
  needs: number;      // padrão 0.5
  wants: number;      // padrão 0.3
  wealth: number;     // padrão 0.2
}

export interface BudgetInput {
  netIncome: number;
  essentialExpenses: number;
  nonEssentialExpenses: number;
  debtPayments: number;
  contributions: number;
  percents?: Partial<BudgetPercents>;
}

export interface BudgetCategoryResult {
  reference: number;
  actual: number;
  percentOfIncome: number;
  diff: number;
  state: BudgetState;
}

export type BudgetState =
  | "on_reference"
  | "above_reference"
  | "below_reference"
  | "incomplete_data"
  | "rigid_structure"
  | "growing_capacity";

export interface BudgetResult {
  valid: boolean;
  netIncome: number;
  percents: BudgetPercents;
  needs: BudgetCategoryResult;
  wants: BudgetCategoryResult;
  wealth: BudgetCategoryResult;
  debts: { actual: number; percentOfIncome: number };
  freeIncome: number;      // renda livre após compromissos
  savingsRate: number;     // (renda - despesas - dívidas) / renda
  hasIncompleteData: boolean;
  hasExpensesOverIncome: boolean;
  toleranceBps: number;    // ±5% da renda considerado dentro
}

export const DEFAULT_BUDGET_PERCENTS: BudgetPercents = { needs: 0.5, wants: 0.3, wealth: 0.2 };
const TOLERANCE = 0.05; // 5% da renda

export function normalizePercents(input?: Partial<BudgetPercents>): BudgetPercents {
  const p = { ...DEFAULT_BUDGET_PERCENTS, ...(input ?? {}) };
  // Não força soma = 1; percentuais são configuráveis.
  return {
    needs: clampUnit(p.needs),
    wants: clampUnit(p.wants),
    wealth: clampUnit(p.wealth),
  };
}

function clampUnit(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function calculateBudgetDistribution(input: BudgetInput): BudgetResult {
  const netIncome = Number.isFinite(input.netIncome) && input.netIncome > 0 ? input.netIncome : 0;
  const percents = normalizePercents(input.percents);
  const essential = safe(input.essentialExpenses);
  const nonEssential = safe(input.nonEssentialExpenses);
  const debts = safe(input.debtPayments);
  const contributions = safe(input.contributions);

  const hasIncompleteData = netIncome === 0 || (essential === 0 && nonEssential === 0);
  const hasExpensesOverIncome = netIncome > 0 && essential + nonEssential + debts > netIncome;

  const needsRef = netIncome * percents.needs;
  const wantsRef = netIncome * percents.wants;
  const wealthRef = netIncome * percents.wealth;

  const needs: BudgetCategoryResult = buildCategory(needsRef, essential, netIncome, hasIncompleteData);
  const wants: BudgetCategoryResult = buildCategory(wantsRef, nonEssential, netIncome, hasIncompleteData);
  const wealth: BudgetCategoryResult = buildCategory(wealthRef, contributions, netIncome, hasIncompleteData);

  // Estados extras específicos.
  if (!hasIncompleteData && needs.actual > needsRef + netIncome * TOLERANCE) {
    needs.state = "rigid_structure";
  }
  if (!hasIncompleteData && wealth.actual < wealthRef - netIncome * TOLERANCE && wealth.actual > 0) {
    wealth.state = "growing_capacity";
  }

  const freeIncome = netIncome > 0 ? netIncome - essential - nonEssential - debts : 0;
  const savingsRate = netIncome > 0 ? Math.max(-1, Math.min(1, freeIncome / netIncome)) : 0;

  return {
    valid: netIncome > 0,
    netIncome,
    percents,
    needs,
    wants,
    wealth,
    debts: { actual: debts, percentOfIncome: netIncome > 0 ? debts / netIncome : 0 },
    freeIncome,
    savingsRate,
    hasIncompleteData,
    hasExpensesOverIncome,
    toleranceBps: TOLERANCE,
  };
}

function safe(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function buildCategory(reference: number, actual: number, netIncome: number, incomplete: boolean): BudgetCategoryResult {
  const diff = actual - reference;
  const percentOfIncome = netIncome > 0 ? actual / netIncome : 0;
  let state: BudgetState;
  if (incomplete) state = "incomplete_data";
  else if (Math.abs(diff) <= netIncome * TOLERANCE) state = "on_reference";
  else if (diff > 0) state = "above_reference";
  else state = "below_reference";
  return { reference, actual, percentOfIncome, diff, state };
}

export function classifyBudgetDistribution(result: BudgetResult): {
  headline: string;
  detail: string;
} {
  if (!result.valid || result.hasIncompleteData) {
    return {
      headline: "Dados incompletos",
      detail: "Preencha sua renda líquida e suas despesas essenciais para ver a distribuição.",
    };
  }
  if (result.hasExpensesOverIncome) {
    return {
      headline: "Estrutura pressionada",
      detail: "Suas despesas e dívidas somadas superam a renda deste mês. Revise gastos e prazos de dívidas antes de aumentar a exposição a risco.",
    };
  }
  const needsPct = Math.round(result.needs.percentOfIncome * 100);
  const wealthPct = Math.round(result.wealth.percentOfIncome * 100);
  if (result.needs.state === "rigid_structure") {
    return {
      headline: `Necessidades em ${needsPct}% da renda`,
      detail: "A estrutura fixa está alta em relação à renda. Isso reduz flexibilidade mensal, mas não significa necessariamente um problema — revise moradia, transporte, dependentes e estabilidade da renda.",
    };
  }
  if (result.wealth.state === "growing_capacity") {
    return {
      headline: `Aporte em ${wealthPct}% da renda`,
      detail: "Sua capacidade de aporte ainda está em evolução. Consolidar reserva antes de aumentar exposição costuma ser uma escolha educacional razoável.",
    };
  }
  return {
    headline: `Distribuição próxima da referência`,
    detail: `Necessidades em ${needsPct}% e aporte em ${wealthPct}% da renda líquida.`,
  };
}

export function calculateSavingsRate(netIncome: number, expenses: number, debtPayments: number): number {
  if (!(netIncome > 0)) return 0;
  return Math.max(-1, Math.min(1, (netIncome - safe(expenses) - safe(debtPayments)) / netIncome));
}