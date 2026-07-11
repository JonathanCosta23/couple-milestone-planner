/**
 * cdiCalculator — motor puro da Calculadora CDI.
 * Não faz I/O. Recebe regras tributárias já carregadas.
 */
import type {
  CdiCalculationResult,
  CdiSimulationInput,
  ContributionSlice,
  IofRule,
  TaxRule,
  ValidationIssue,
} from "../types/cdi";
import {
  calculateIncomeTax,
  calculateIncomeTaxRate,
  calculateIof,
  calculateIofRate,
} from "./cdiTaxService";

/** Converte taxa anual em taxa diária (base 252 dias úteis). */
export function annualRateToDailyRate(annualRate: number): number {
  if (!Number.isFinite(annualRate) || annualRate <= -1) return 0;
  return Math.pow(1 + annualRate, 1 / 252) - 1;
}

/** Retorno bruto composto para um principal e um número de dias úteis. */
export function calculateCdiGrossReturn(principal: number, dailyProductRate: number, businessDays: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(businessDays) || businessDays <= 0) return principal;
  if (!Number.isFinite(dailyProductRate) || dailyProductRate <= -1) return principal;
  return principal * Math.pow(1 + dailyProductRate, businessDays);
}

export function validateCdiSimulationInput(input: CdiSimulationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(input.principal) || input.principal < 0) issues.push({ field: "principal", message: "Valor inicial inválido." });
  if (!Number.isFinite(input.cdiPercent) || input.cdiPercent < 0) issues.push({ field: "cdiPercent", message: "Percentual do CDI inválido." });
  if (!Number.isFinite(input.cdiAnnualRate) || input.cdiAnnualRate <= -1) issues.push({ field: "cdiAnnualRate", message: "Taxa CDI anual inválida." });
  if (!Number.isFinite(input.businessDays) || input.businessDays < 0) issues.push({ field: "businessDays", message: "Prazo inválido." });
  if (input.additionalContribution) {
    const c = input.additionalContribution;
    if (!Number.isFinite(c.amount) || c.amount < 0) issues.push({ field: "additionalContribution.amount", message: "Valor de aporte inválido." });
    if (!Number.isInteger(c.count) || c.count < 0) issues.push({ field: "additionalContribution.count", message: "Quantidade de aportes inválida." });
    if (!Number.isInteger(c.frequencyMonths) || c.frequencyMonths < 1) issues.push({ field: "additionalContribution.frequencyMonths", message: "Frequência inválida." });
  }
  if (input.inflationAnnualRate != null && (!Number.isFinite(input.inflationAnnualRate) || input.inflationAnnualRate <= -1)) {
    issues.push({ field: "inflationAnnualRate", message: "Inflação inválida." });
  }
  return issues;
}

function categoryFor(regime: CdiSimulationInput["taxRegime"]): string {
  return regime === "exempt" ? "fixed_income_exempt" : "fixed_income_taxable";
}

function daysToCalendarDaysApprox(businessDays: number): number {
  // aproximação: 252 úteis = 365 corridos
  return Math.round((businessDays * 365) / 252);
}

export interface CdiCalculationDeps {
  taxRules: TaxRule[];
  iofRules: IofRule[];
}

/**
 * Cálculo principal. Suporta principal + aporte recorrente mensal (aproximação por dias úteis).
 * Cada aporte capitaliza apenas pelo período em que esteve investido.
 */
export function calculateCdiInvestment(
  input: CdiSimulationInput,
  deps: CdiCalculationDeps,
  mode: CdiCalculationResult["mode"] = "simple",
): CdiCalculationResult {
  const issues = validateCdiSimulationInput(input);
  const warnings: string[] = [];
  if (issues.length > 0) {
    return emptyResult(input, mode, issues.map(i => `${i.field}: ${i.message}`));
  }

  const dailyCdi = annualRateToDailyRate(input.cdiAnnualRate);
  const productDaily = dailyCdi * input.cdiPercent;
  const category = categoryFor(input.taxRegime);

  const businessDaysTotal = Math.max(0, Math.round(input.businessDays));
  const slices: ContributionSlice[] = [];

  // Fatia principal na data zero.
  slices.push(buildSlice(input.principal, 0, businessDaysTotal, productDaily, category, deps, input.redeemHoldingDay));

  const contrib = input.additionalContribution;
  if (contrib && contrib.count > 0 && contrib.amount > 0) {
    const daysPerContribution = Math.round((contrib.frequencyMonths * 252) / 12); // ~21 úteis por mês
    for (let i = 1; i <= contrib.count; i++) {
      const entryDay = i * daysPerContribution;
      const remaining = Math.max(0, businessDaysTotal - entryDay);
      if (remaining <= 0) {
        warnings.push("Um ou mais aportes foram programados após o prazo final e não foram capitalizados.");
        continue;
      }
      slices.push(buildSlice(contrib.amount, entryDay, remaining, productDaily, category, deps, input.redeemHoldingDay));
    }
  }

  const totalInvested = slices.reduce((s, x) => s + x.principal, 0);
  const grossValue = slices.reduce((s, x) => s + x.grossValue, 0);
  const grossYield = grossValue - totalInvested;

  const annualFee = input.annualFeeRate ?? 0;
  const years = businessDaysTotal / 252;
  const feeCost = annualFee > 0 ? totalInvested * annualFee * years : 0;
  const otherCosts = input.otherCosts ?? 0;
  const costs = feeCost + otherCosts;

  const iof = slices.reduce((s, x) => s + x.iof, 0);
  const incomeTax = slices.reduce((s, x) => s + x.incomeTax, 0);

  const netValue = grossValue - costs - iof - incomeTax;
  const netYield = netValue - totalInvested;

  const inflationAnnual = input.inflationAnnualRate ?? 0;
  const inflationAccumulated = years > 0 ? Math.pow(1 + inflationAnnual, years) - 1 : 0;
  const realValue = inflationAccumulated > -1 ? netValue / (1 + inflationAccumulated) : netValue;
  const realYield = realValue - totalInvested;

  // Metadados de versão e fontes.
  const firstIrRule = slices.find(s => s.incomeTax > 0);
  const firstIrLookup = calculateIncomeTaxRate(daysToCalendarDaysApprox(businessDaysTotal), category, deps.taxRules);
  const iofLookup = input.redeemHoldingDay != null
    ? calculateIofRate(input.redeemHoldingDay, category, deps.iofRules)
    : { rate: 0, rule: null, version: "n/a" as string };

  const sources: string[] = [];
  const addSource = (name?: string | null, url?: string | null) => {
    if (!name && !url) return;
    const entry = [name, url].filter(Boolean).join(" — ");
    if (entry && !sources.includes(entry)) sources.push(entry);
  };
  addSource(firstIrLookup.rule?.source_name, firstIrLookup.rule?.source_url);
  if (iofLookup.rule) addSource(iofLookup.rule.source_name, iofLookup.rule.source_url);

  if (mode === "simple") {
    warnings.unshift("Estimativa baseada em taxa anual constante. O CDI real pode variar durante o período.");
  }

  return {
    input,
    dailyRate: dailyCdi,
    productDailyRate: productDaily,
    totalInvested,
    grossValue,
    grossYield,
    costs,
    iof,
    incomeTax,
    netValue,
    netYield,
    inflationAccumulated,
    realValue,
    realYield,
    incomeTaxRate: firstIrLookup.rate,
    iofRate: iofLookup.rate,
    contributions: slices,
    rulesVersion: {
      incomeTax: firstIrLookup.version,
      iof: iofLookup.version,
    },
    sources,
    warnings,
    mode,
  };
  void firstIrRule;
}

function buildSlice(
  principal: number,
  entryDay: number,
  businessDays: number,
  productDaily: number,
  category: string,
  deps: CdiCalculationDeps,
  redeemHoldingDay?: number,
): ContributionSlice {
  const grossValue = calculateCdiGrossReturn(principal, productDaily, businessDays);
  const grossYield = grossValue - principal;
  const calendarDays = daysToCalendarDaysApprox(businessDays);
  const irLookup = calculateIncomeTaxRate(calendarDays, category, deps.taxRules);
  const iofLookup = redeemHoldingDay != null
    ? calculateIofRate(redeemHoldingDay, category, deps.iofRules)
    : { rate: 0, rule: null, version: "n/a" };
  const iof = calculateIof(grossYield, iofLookup.rate);
  const taxableAfterIof = Math.max(0, grossYield - iof);
  const incomeTax = calculateIncomeTax(taxableAfterIof, irLookup.rate);
  const netValue = grossValue - iof - incomeTax;
  return { principal, entryDay, businessDays, grossValue, grossYield, incomeTax, iof, netValue };
}

function emptyResult(input: CdiSimulationInput, mode: CdiCalculationResult["mode"], warnings: string[]): CdiCalculationResult {
  return {
    input,
    dailyRate: 0,
    productDailyRate: 0,
    totalInvested: 0,
    grossValue: 0,
    grossYield: 0,
    costs: 0,
    iof: 0,
    incomeTax: 0,
    netValue: 0,
    netYield: 0,
    inflationAccumulated: 0,
    realValue: 0,
    realYield: 0,
    incomeTaxRate: 0,
    iofRate: 0,
    contributions: [],
    rulesVersion: {},
    sources: [],
    warnings,
    mode,
  };
}

export interface CdiScenarioInput extends Omit<CdiSimulationInput, "cdiPercent"> {
  label: string;
  cdiPercent: number;
}

export function compareCdiScenarios(scenarios: CdiScenarioInput[], deps: CdiCalculationDeps): Array<CdiCalculationResult & { label: string }> {
  return scenarios.map(s => ({
    ...calculateCdiInvestment(s, deps, "detailed"),
    label: s.label,
  }));
}

export function buildCdiCalculationBreakdown(result: CdiCalculationResult): Array<{ label: string; value: string; hint?: string }> {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (n: number) => `${(n * 100).toFixed(4)}%`;
  return [
    { label: "Taxa CDI anual utilizada", value: pct(result.input.cdiAnnualRate) },
    { label: "Percentual do CDI", value: `${(result.input.cdiPercent * 100).toFixed(2)}%` },
    { label: "Taxa diária do CDI", value: pct(result.dailyRate), hint: "(1 + CDI)^(1/252) − 1" },
    { label: "Taxa diária do produto", value: pct(result.productDailyRate), hint: "taxa diária × % do CDI" },
    { label: "Dias úteis totais", value: String(result.input.businessDays) },
    { label: "Total investido", value: fmt(result.totalInvested) },
    { label: "Rendimento bruto", value: fmt(result.grossYield) },
    { label: "Custos informados", value: fmt(result.costs) },
    { label: "IOF estimado", value: fmt(result.iof), hint: result.rulesVersion.iof ? `regra v${result.rulesVersion.iof}` : undefined },
    { label: "IR estimado", value: fmt(result.incomeTax), hint: result.rulesVersion.incomeTax ? `regra v${result.rulesVersion.incomeTax} · alíquota ${(result.incomeTaxRate * 100).toFixed(2)}%` : undefined },
    { label: "Valor líquido estimado", value: fmt(result.netValue) },
    { label: "Inflação acumulada estimada", value: `${(result.inflationAccumulated * 100).toFixed(2)}%` },
    { label: "Valor real estimado", value: fmt(result.realValue) },
  ];
}