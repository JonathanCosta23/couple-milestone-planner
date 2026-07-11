/**
 * financialIndependenceCalculator — Cenários educacionais 200 / 250 / 333.
 * Nunca promete retorno, renda estável ou preservação do principal.
 */

export type WithdrawalScenarioKey = "cons_333" | "int_250" | "simple_200" | "custom";

export interface WithdrawalScenario {
  key: WithdrawalScenarioKey;
  label: string;
  monthlyRate: number;   // ex: 0.003
  multiplier: number;    // 1 / monthlyRate
  targetWealth: number;
  gap: number;           // sempre >= 0
  percentAchieved: number; // 0-100
  referenceIncomeFromCurrent: number; // renda mensal produzida pelo patrimônio atual
}

export interface FinancialIndependenceInput {
  desiredMonthlyIncome: number;
  currentWealth: number;
  customMonthlyRate?: number; // apenas modo detalhado
}

export interface FinancialIndependenceResult {
  desiredMonthlyIncome: number;
  currentWealth: number;
  scenarios: WithdrawalScenario[];
  disclaimer: string;
}

export const DEFAULT_SCENARIOS: { key: Exclude<WithdrawalScenarioKey, "custom">; label: string; monthlyRate: number; multiplier: number }[] = [
  { key: "cons_333", label: "Conservador (0,3% ao mês · 333×)", monthlyRate: 0.003, multiplier: 333 },
  { key: "int_250", label: "Intermediário (0,4% ao mês · 250×)", monthlyRate: 0.004, multiplier: 250 },
  { key: "simple_200", label: "Simplificado (0,5% ao mês · 200×)", monthlyRate: 0.005, multiplier: 200 },
];

export const FI_DISCLAIMER =
  "Os multiplicadores 200, 250 e 333 representam cenários hipotéticos de retirada mensal. Não garantem preservação do patrimônio, renda estável ou retorno futuro. Inflação, impostos, custos, volatilidade e mudanças na renda dos ativos podem alterar significativamente o resultado.";

function safe(v: number): number { return Number.isFinite(v) && v > 0 ? v : 0; }

export function calculateFinancialIndependenceTarget(desired: number, monthlyRate: number): number {
  const d = safe(desired);
  if (!(monthlyRate > 0)) return Infinity;
  return d / monthlyRate;
}

export function calculateReferenceMonthlyIncome(currentWealth: number, monthlyRate: number): number {
  const w = safe(currentWealth);
  if (!(monthlyRate > 0)) return 0;
  return w * monthlyRate;
}

export function compareWithdrawalScenarios(input: FinancialIndependenceInput): FinancialIndependenceResult {
  const desired = safe(input.desiredMonthlyIncome);
  const current = safe(input.currentWealth);

  const scenarios: WithdrawalScenario[] = DEFAULT_SCENARIOS.map((s) => buildScenario(s.key, s.label, s.monthlyRate, s.multiplier, desired, current));

  if (input.customMonthlyRate !== undefined && Number.isFinite(input.customMonthlyRate) && input.customMonthlyRate > 0) {
    const rate = input.customMonthlyRate;
    const multiplier = Math.round(1 / rate);
    scenarios.push(buildScenario("custom", `Personalizado (${(rate * 100).toFixed(2)}% ao mês · ${multiplier}×)`, rate, multiplier, desired, current));
  }

  // Garante ordem coerente: 333 > 250 > 200 em targetWealth.
  scenarios.sort((a, b) => a.monthlyRate - b.monthlyRate);

  return { desiredMonthlyIncome: desired, currentWealth: current, scenarios, disclaimer: FI_DISCLAIMER };
}

function buildScenario(key: WithdrawalScenarioKey, label: string, rate: number, multiplier: number, desired: number, current: number): WithdrawalScenario {
  const target = desired / rate;
  const gap = Math.max(0, target - current);
  const percentAchieved = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const referenceIncomeFromCurrent = current * rate;
  return { key, label, monthlyRate: rate, multiplier, targetWealth: target, gap, percentAchieved, referenceIncomeFromCurrent };
}