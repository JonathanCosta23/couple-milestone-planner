/**
 * emergencyFundCalculator — Reserva de emergência baseada em despesas essenciais.
 * Nunca usa salário × 6 como fórmula principal.
 * Nunca declara "totalmente protegido".
 */

export type ReserveState =
  | "not_started"
  | "building"
  | "basic_complete"
  | "intermediate_complete"
  | "extended_complete"
  | "insufficient_data";

export interface EmergencyFundInput {
  essentialMonthlyExpenses: number;
  months: number;                 // 3/6/9/12 ou personalizado
  currentEligibleReserve: number; // já filtrada por liquidez
  monthlyContributionToReserve?: number;
}

export interface EmergencyFundResult {
  essentialMonthlyExpenses: number;
  months: number;
  target: number;
  currentEligibleReserve: number;
  gap: number;                    // sempre >= 0
  progressPercentage: number;     // 0-100
  monthlyContributionToReserve: number;
  estimatedMonthsToComplete: number | null;
  scenarios: { months: 3 | 6 | 9 | 12; target: number }[];
  state: ReserveState;
}

export function calculateEmergencyFundTarget(essential: number, months: number): number {
  const e = safe(essential);
  const m = safeMonths(months);
  return e * m;
}

export function calculateEmergencyFundGap(target: number, current: number): number {
  return Math.max(0, safe(target) - safe(current));
}

export function calculateEmergencyFundMonths(current: number, essential: number): number {
  if (!(essential > 0)) return 0;
  return safe(current) / essential;
}

export function calculateEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const essential = safe(input.essentialMonthlyExpenses);
  const months = safeMonths(input.months);
  const target = essential * months;
  const current = safe(input.currentEligibleReserve);
  const gap = Math.max(0, target - current);
  const contribution = safe(input.monthlyContributionToReserve ?? 0);
  const progressPercentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const estimatedMonthsToComplete =
    gap === 0 ? 0 : contribution > 0 ? Math.ceil(gap / contribution) : null;

  const scenarios: EmergencyFundResult["scenarios"] = ([3, 6, 9, 12] as const).map((m) => ({
    months: m,
    target: essential * m,
  }));

  const state = classifyReserveState({ essential, current, months });
  return {
    essentialMonthlyExpenses: essential,
    months,
    target,
    currentEligibleReserve: current,
    gap,
    progressPercentage,
    monthlyContributionToReserve: contribution,
    estimatedMonthsToComplete,
    scenarios,
    state,
  };
}

function classifyReserveState(p: { essential: number; current: number; months: number }): ReserveState {
  if (p.essential <= 0) return "insufficient_data";
  const currentMonths = p.current / p.essential;
  if (currentMonths <= 0) return "not_started";
  if (currentMonths < 3) return "building";
  if (currentMonths < 6) return "basic_complete";
  if (currentMonths < 12) return "intermediate_complete";
  return "extended_complete";
}

// ---- Estabilidade da renda ----
export type IncomeType = "clt" | "servidor" | "pj" | "autonomo" | "empresario" | "aposentado" | "variavel";

export interface StabilityQuestionnaire {
  incomeType: IncomeType;
  dependents: number;
  hasSecondIncome: boolean;
  incomeVariesSignificantly: boolean;
  hasRelevantInsurance: boolean;
  hasRecurringMedicalExpenses: boolean;
  hasShortTermDebt: boolean;
  coupleTwoIncomes?: boolean;      // apenas modo casal
  estimatedMonthsToRecoverIncome: number;
}

export interface SuggestedReserveRange {
  minMonths: number;
  maxMonths: number;
  rationale: string;
}

/**
 * Sugestão educacional de faixa (nunca prescritiva).
 * Retorna faixa em meses e um texto curto explicando o motivo.
 */
export function suggestEmergencyFundRange(q: StabilityQuestionnaire): SuggestedReserveRange {
  let min = 3;
  let max = 6;
  const reasons: string[] = [];

  const stableIncome = q.incomeType === "clt" || q.incomeType === "servidor" || q.incomeType === "aposentado";
  if (!stableIncome) {
    min = Math.max(min, 6);
    max = Math.max(max, 9);
    reasons.push("renda variável ou autônoma");
  }
  if (q.incomeVariesSignificantly) {
    min = Math.max(min, 6);
    max = Math.max(max, 12);
    reasons.push("renda oscila muito");
  }
  if (q.dependents >= 3) {
    min = Math.max(min, 6);
    max = Math.max(max, 12);
    reasons.push("muitos dependentes");
  } else if (q.dependents >= 1) {
    max = Math.max(max, 9);
    reasons.push("existem dependentes");
  }
  if (q.coupleTwoIncomes === true) {
    reasons.push("casal com duas rendas independentes");
  } else if (q.coupleTwoIncomes === false) {
    min = Math.max(min, 6);
    max = Math.max(max, 12);
    reasons.push("casal depende de uma única renda");
  }
  if (q.hasShortTermDebt) {
    max = Math.max(max, 9);
    reasons.push("dívidas de curto prazo");
  }
  if (q.hasRecurringMedicalExpenses) {
    max = Math.max(max, 12);
    reasons.push("despesas médicas recorrentes");
  }
  if (q.estimatedMonthsToRecoverIncome >= 6) {
    max = Math.max(max, 12);
    reasons.push("recomposição da renda pode demorar");
  }
  if (q.hasSecondIncome && stableIncome && q.dependents === 0) {
    max = Math.max(min + 3, 6);
    reasons.push("segunda fonte de renda estável");
  }

  const rationale = reasons.length > 0
    ? `Faixa educacional considerando ${reasons.join(", ")}.`
    : "Faixa educacional baseada em estabilidade padrão. Ajuste conforme sua realidade.";

  return { minMonths: min, maxMonths: max, rationale };
}

// ---- Ativos elegíveis ----
export interface AssetLite {
  type?: string;
  currentBalance: number;
  liquidity?: string;    // 'daily' | 'up-to-30d' | 'longer'
  maturityDate?: string; // ISO
  active?: boolean;
}

const ELIGIBLE_TYPES = new Set(["tesouro-selic", "poupanca", "cdb-liquidez-diaria"]);
const INELIGIBLE_TYPES = new Set([
  "acoes", "fii", "cripto", "previdencia", "imovel", "debentures",
  "fundos-multimercado", "renda-variavel",
]);

export interface EligibilityBreakdown {
  eligibleTotal: number;
  ineligibleTotal: number;
  unclassifiedTotal: number;   // sem info suficiente
  hasUnclassified: boolean;
}

export function computeEligibleReserve(assets: AssetLite[]): EligibilityBreakdown {
  let eligible = 0;
  let ineligible = 0;
  let unclassified = 0;
  const now = Date.now();
  for (const a of assets) {
    if (a.active === false) continue;
    const balance = safe(a.currentBalance);
    if (balance <= 0) continue;
    const type = (a.type ?? "").toLowerCase();
    const maturityFar = a.maturityDate
      ? new Date(a.maturityDate).getTime() - now > 90 * 24 * 3600 * 1000
      : false;
    if (INELIGIBLE_TYPES.has(type)) {
      ineligible += balance;
      continue;
    }
    if (maturityFar) {
      ineligible += balance;
      continue;
    }
    if (ELIGIBLE_TYPES.has(type) || a.liquidity === "daily") {
      eligible += balance;
      continue;
    }
    unclassified += balance;
  }
  return {
    eligibleTotal: eligible,
    ineligibleTotal: ineligible,
    unclassifiedTotal: unclassified,
    hasUnclassified: unclassified > 0,
  };
}

function safe(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}
function safeMonths(m: number): number {
  if (!Number.isFinite(m) || m <= 0) return 0;
  return Math.min(60, Math.max(0, Math.round(m)));
}