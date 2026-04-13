/**
 * Financial Intelligence Engine — Plano do Milhão V7
 * Score, diagnostics, journey phases, bottleneck detection, insights.
 */

import { AppData, ExpenseCategory, EXPENSE_CATEGORY_LABELS, Investment, PatrimonialBucketId, SecurityLevel, getDefaultSecurity, getDefaultBucket, BUCKET_LABELS, BUCKET_DESCRIPTIONS } from "./models";
import { PlanConfig, MonthRecord, getCurrentMonthKey, formatBRL } from "./types";
import { calculateStreak, generateProjection, getContributionTotals } from "./calculator";

// ===== Financial Health Score =====

export interface HealthScoreBreakdown {
  total: number; // 0-100
  balanceScore: number; // equilíbrio mensal
  consistencyScore: number; // consistência de aporte
  debtScore: number; // peso das dívidas
  emergencyScore: number; // qualidade da reserva
  flowClarityScore: number; // clareza do fluxo
  allocationRiskScore: number; // risco da alocação
  concentrationScore: number; // concentração patrimonial
  disciplineScore: number; // disciplina financeira
}

export function calculateHealthScore(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): HealthScoreBreakdown {
  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const currentKey = getCurrentMonthKey();
  const monthExpenses = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const activeDebts = appData.debts.filter(d => d.active);
  const totalDebtPayment = activeDebts.reduce((s, d) => s + d.monthlyPayment, 0);
  const totalInvestments = appData.investments.filter(i => i.active).reduce((s, i) => s + i.currentBalance, 0);
  const monthlyContributions = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);

  // 1. Balance Score (income vs expenses)
  const balanceScore = totalIncome > 0
    ? Math.min(100, Math.max(0, ((totalIncome - totalExpenses - totalDebtPayment) / totalIncome) * 100))
    : 50;

  // 2. Consistency Score (streak-based)
  const streak = calculateStreak(config, monthRecords, startDate);
  const consistencyScore = Math.min(100, streak * 15);

  // 3. Debt Score (lower debt = higher score)
  const debtRatio = totalIncome > 0 ? totalDebtPayment / totalIncome : 0;
  const toxicDebts = activeDebts.filter(d => d.risk === "toxic" || d.risk === "high").length;
  const debtScore = Math.max(0, 100 - debtRatio * 200 - toxicDebts * 15);

  // 4. Emergency Score
  const monthlyExpenseEstimate = totalExpenses > 0 ? totalExpenses : (totalIncome * 0.6);
  const emergencyFund = appData.investments
    .filter(i => i.active && (i.type === "tesouro-selic" || i.type === "poupanca"))
    .reduce((s, i) => s + i.currentBalance, 0);
  const emergencyMonths = monthlyExpenseEstimate > 0 ? emergencyFund / monthlyExpenseEstimate : 0;
  const emergencyScore = Math.min(100, emergencyMonths * 16.67); // 6 months = 100

  // 5. Flow Clarity (has income + expenses tracked)
  const hasIncome = appData.incomes.length > 0;
  const hasExpenses = appData.expenses.length > 0;
  const hasDebts = appData.debts.length > 0 || activeDebts.length === 0;
  const flowClarityScore = (hasIncome ? 40 : 0) + (hasExpenses ? 40 : 0) + (hasDebts ? 20 : 0);

  // 6. Allocation Risk
  const totalBalance = totalInvestments + config.initialAmount;
  const safeAssets = appData.investments
    .filter(i => i.active && ["tesouro-selic", "cdb", "lci-lca", "poupanca"].includes(i.type))
    .reduce((s, i) => s + i.currentBalance, 0);
  const safeRatio = totalBalance > 0 ? safeAssets / totalBalance : 1;
  const allocationRiskScore = Math.min(100, safeRatio * 80 + 20);

  // 7. Concentration (by institution)
  const byInstitution = new Map<string, number>();
  appData.investments.filter(i => i.active).forEach(i => {
    byInstitution.set(i.institution, (byInstitution.get(i.institution) || 0) + i.currentBalance);
  });
  const maxConcentration = byInstitution.size > 0
    ? Math.max(...byInstitution.values()) / Math.max(1, totalInvestments)
    : 0;
  const concentrationScore = Math.max(0, 100 - maxConcentration * 60);

  // 8. Discipline (savings rate + investment ratio)
  const savingsRate = totalIncome > 0 ? monthlyContributions / totalIncome : 0;
  const disciplineScore = Math.min(100, savingsRate * 300 + consistencyScore * 0.3);

  const weights = [0.15, 0.15, 0.15, 0.12, 0.08, 0.1, 0.1, 0.15];
  const scores = [balanceScore, consistencyScore, debtScore, emergencyScore, flowClarityScore, allocationRiskScore, concentrationScore, disciplineScore];
  const total = Math.round(scores.reduce((s, score, i) => s + score * weights[i], 0));

  return {
    total: Math.min(100, Math.max(0, total)),
    balanceScore: Math.round(balanceScore),
    consistencyScore: Math.round(consistencyScore),
    debtScore: Math.round(debtScore),
    emergencyScore: Math.round(emergencyScore),
    flowClarityScore: Math.round(flowClarityScore),
    allocationRiskScore: Math.round(allocationRiskScore),
    concentrationScore: Math.round(concentrationScore),
    disciplineScore: Math.round(disciplineScore),
  };
}

// ===== Financial Diagnostic =====

export interface FinancialDiagnostic {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  fixedExpenseWeight: number;
  variableExpenseWeight: number;
  debtWeight: number;
  cardDependency: number;
  investmentRate: number;
  emergencyMonths: number;
  currentNetWorth: number;
  investedWealth: number;
  liquidNetWorth: number;
  monthsToMillion: number | null;
  biggestBottleneck: string;
  biggestOpportunity: string;
}

export function calculateDiagnostic(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): FinancialDiagnostic {
  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const currentKey = getCurrentMonthKey();
  const monthExp = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExp.reduce((s, e) => s + e.amount, 0);
  const fixedExp = monthExp.filter(e => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
  const variableExp = monthExp.filter(e => e.type === "variable").reduce((s, e) => s + e.amount, 0);
  const activeDebts = appData.debts.filter(d => d.active);
  const totalDebtPayment = activeDebts.reduce((s, d) => s + d.monthlyPayment, 0);
  const totalDebtBalance = activeDebts.reduce((s, d) => s + d.totalAmount, 0);
  const cardExpenses = monthExp.filter(e => e.category === "cartao").reduce((s, e) => s + e.amount, 0);
  const monthlyInvestment = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const investedWealth = appData.investments.filter(i => i.active).reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;

  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses - totalDebtPayment) / totalIncome : 0;
  const fixedExpenseWeight = totalIncome > 0 ? fixedExp / totalIncome : 0;
  const variableExpenseWeight = totalIncome > 0 ? variableExp / totalIncome : 0;
  const debtWeight = totalIncome > 0 ? totalDebtPayment / totalIncome : 0;
  const cardDependency = totalExpenses > 0 ? cardExpenses / totalExpenses : 0;
  const investmentRate = totalIncome > 0 ? monthlyInvestment / totalIncome : 0;

  const expenseEstimate = totalExpenses > 0 ? totalExpenses : (totalIncome * 0.6);
  const emergencyAssets = appData.investments
    .filter(i => i.active && (i.type === "tesouro-selic" || i.type === "poupanca"))
    .reduce((s, i) => s + i.currentBalance, 0);
  const emergencyMonths = expenseEstimate > 0 ? emergencyAssets / expenseEstimate : 0;

  const currentNetWorth = investedWealth - totalDebtBalance;
  const liquidNetWorth = currentNetWorth;

  const projection = generateProjection(config, "planned", monthRecords, startDate);
  const targetIdx = projection.findIndex(r => r.totalBalance >= config.targetAmount);
  const monthsToMillion = targetIdx >= 0 ? targetIdx + 1 : null;

  // Bottleneck detection
  const bottlenecks: { label: string; severity: number }[] = [];
  if (debtWeight > 0.3) bottlenecks.push({ label: "Dívidas consomem mais de 30% da renda", severity: debtWeight * 100 });
  if (fixedExpenseWeight > 0.5) bottlenecks.push({ label: "Gastos fixos pesam mais de 50% da renda", severity: fixedExpenseWeight * 100 });
  if (savingsRate < 0.1) bottlenecks.push({ label: "Taxa de poupança muito baixa (< 10%)", severity: 80 });
  if (emergencyMonths < 3) bottlenecks.push({ label: "Reserva de emergência insuficiente", severity: 70 });
  if (cardDependency > 0.4) bottlenecks.push({ label: "Alta dependência de cartão de crédito", severity: 60 });
  if (totalIncome === 0) bottlenecks.push({ label: "Nenhuma renda cadastrada", severity: 90 });
  bottlenecks.sort((a, b) => b.severity - a.severity);

  const opportunities: { label: string; impact: number }[] = [];
  if (savingsRate > 0.2) opportunities.push({ label: "Boa taxa de poupança — pode acelerar aportes", impact: 80 });
  if (variableExpenseWeight > 0.2) opportunities.push({ label: "Gastos variáveis podem ser otimizados", impact: 70 });
  if (emergencyMonths >= 6) opportunities.push({ label: "Reserva completa — pode focar em crescimento", impact: 90 });
  if (totalIncome > 0 && investmentRate < 0.15) opportunities.push({ label: "Pode aumentar o percentual investido", impact: 60 });
  opportunities.sort((a, b) => b.impact - a.impact);

  return {
    totalIncome,
    totalExpenses,
    savingsRate,
    fixedExpenseWeight,
    variableExpenseWeight,
    debtWeight,
    cardDependency,
    investmentRate,
    emergencyMonths,
    currentNetWorth,
    investedWealth,
    liquidNetWorth,
    monthsToMillion,
    biggestBottleneck: bottlenecks[0]?.label || "Nenhum gargalo crítico identificado",
    biggestOpportunity: opportunities[0]?.label || "Continue cadastrando dados para insights personalizados",
  };
}

// ===== Financial Journey Phases =====

export type JourneyPhase = "chaos" | "control" | "protection" | "accumulation" | "acceleration" | "consolidation" | "passive-income" | "functional-wealth";

export interface JourneyPhaseInfo {
  id: JourneyPhase;
  name: string;
  emoji: string;
  description: string;
  entryCriteria: string[];
  exitCriteria: string[];
  commonRisks: string[];
  priorities: string[];
  nextSteps: string[];
  recommendations: string[];
  educationTopics: string[];
}

export const JOURNEY_PHASES: JourneyPhaseInfo[] = [
  {
    id: "chaos",
    name: "Caos Financeiro",
    emoji: "🔴",
    description: "Sem controle sobre gastos, dívidas acumulando, sem visão do fluxo financeiro.",
    entryCriteria: ["Não sabe quanto ganha ou gasta", "Dívidas rotativas", "Sem reserva de emergência"],
    exitCriteria: ["Mapeou todas as receitas e despesas", "Parou de criar novas dívidas"],
    commonRisks: ["Paralisar por medo", "Ignorar dívidas", "Gastar por impulso"],
    priorities: ["Mapear tudo que entra e sai", "Parar de criar novas dívidas", "Negociar dívidas existentes"],
    nextSteps: ["Cadastrar todas as receitas", "Cadastrar todos os gastos", "Listar todas as dívidas"],
    recommendations: ["Foque em clareza antes de investir", "Não se endivide mais", "Corte gastos não-essenciais"],
    educationTopics: ["Orçamento básico", "Como sair das dívidas", "Juros compostos contra você"],
  },
  {
    id: "control",
    name: "Controle",
    emoji: "🟡",
    description: "Sabe quanto ganha e gasta. Sem novas dívidas, mas ainda sem reserva.",
    entryCriteria: ["Fluxo mapeado", "Sem novas dívidas", "Saldo positivo mensal"],
    exitCriteria: ["Reserva de emergência de 3 meses", "Taxa de poupança > 10%"],
    commonRisks: ["Voltar a gastar sem controle", "Não criar reserva", "Investir sem reserva"],
    priorities: ["Criar reserva de emergência", "Manter orçamento equilibrado", "Eliminar dívidas restantes"],
    nextSteps: ["Abrir conta no Tesouro Direto", "Guardar em Tesouro Selic", "Meta: 3 meses de despesas"],
    recommendations: ["Tesouro Selic é seu melhor amigo agora", "Não invista em risco ainda", "Automatize o aporte"],
    educationTopics: ["Tesouro Selic", "Reserva de emergência", "FGC"],
  },
  {
    id: "protection",
    name: "Proteção",
    emoji: "🟢",
    description: "Reserva de emergência formada. Protegido contra imprevistos.",
    entryCriteria: ["Reserva de 3-6 meses", "Sem dívidas de alto custo", "Orçamento equilibrado"],
    exitCriteria: ["Reserva de 6 meses", "Investindo regularmente", "Taxa de poupança > 15%"],
    commonRisks: ["Usar reserva para investir", "Relaxar no controle", "Não diversificar"],
    priorities: ["Completar 6 meses de reserva", "Iniciar aportes recorrentes", "Estudar investimentos"],
    nextSteps: ["Completar reserva para 6 meses", "Começar CDB ou Tesouro IPCA+", "Definir meta de aporte mensal"],
    recommendations: ["Não toque na reserva para investir", "Comece com renda fixa", "Diversifique aos poucos"],
    educationTopics: ["CDB vs Tesouro", "LCI/LCA", "Diversificação básica"],
  },
  {
    id: "accumulation",
    name: "Acumulação",
    emoji: "🔵",
    description: "Investindo regularmente com disciplina. Patrimônio crescendo.",
    entryCriteria: ["Reserva completa", "Aporte recorrente", "Patrimônio > R$ 50k"],
    exitCriteria: ["Patrimônio > R$ 250k", "Diversificação adequada", "Taxa de poupança > 20%"],
    commonRisks: ["Concentração em um ativo", "Ultrapassar limite FGC", "Impaciência"],
    priorities: ["Manter consistência", "Diversificar", "Aumentar aporte", "Controlar FGC"],
    nextSteps: ["Revisar alocação", "Verificar limites FGC", "Buscar aumentar renda"],
    recommendations: ["Consistência > rentabilidade", "Cuidado com FGC por instituição", "Aumente aporte quando possível"],
    educationTopics: ["FGC 250k", "Marcação a mercado", "Tesouro IPCA+", "Alocação de ativos"],
  },
  {
    id: "acceleration",
    name: "Aceleração",
    emoji: "🚀",
    description: "Patrimônio relevante, buscando crescimento acelerado.",
    entryCriteria: ["Patrimônio > R$ 250k", "Disciplina consolidada", "Renda crescente"],
    exitCriteria: ["Patrimônio > R$ 500k", "Renda passiva iniciando"],
    commonRisks: ["Excesso de confiança", "Risco excessivo", "Não proteger ganhos"],
    priorities: ["Acelerar aportes", "Diversificar entre classes", "Proteger capital"],
    nextSteps: ["Avaliar renda variável", "Considerar imóveis/FIIs", "Otimizar impostos"],
    recommendations: ["Proteja o que construiu", "Diversifique entre classes", "Pense em renda passiva"],
    educationTopics: ["Renda variável básica", "FIIs", "Imposto de renda sobre investimentos"],
  },
  {
    id: "consolidation",
    name: "Consolidação",
    emoji: "💎",
    description: "Meio milhão+ investido. Juros compostos trabalhando forte.",
    entryCriteria: ["Patrimônio > R$ 500k", "Carteira diversificada"],
    exitCriteria: ["Patrimônio > R$ 750k", "Renda passiva cobrindo parte dos gastos"],
    commonRisks: ["Mudança brusca de estratégia", "Não rebalancear"],
    priorities: ["Rebalancear carteira", "Otimizar tributação", "Planejar renda passiva"],
    nextSteps: ["Revisar alocação anualmente", "Calcular renda passiva atual", "Planejar próxima fase"],
    recommendations: ["O jogo agora é manutenção e paciência", "Rebalanceie semestralmente"],
    educationTopics: ["Rebalanceamento", "Tributação otimizada", "Planejamento sucessório"],
  },
  {
    id: "passive-income",
    name: "Renda Passiva Parcial",
    emoji: "🌟",
    description: "Renda passiva começa a cobrir parte significativa dos gastos.",
    entryCriteria: ["Patrimônio > R$ 750k", "Renda passiva > 30% dos gastos"],
    exitCriteria: ["Renda passiva > 100% dos gastos"],
    commonRisks: ["Parar de aportar cedo demais", "Inflação corroer renda"],
    priorities: ["Manter aportes", "Proteger contra inflação", "Diversificar fontes"],
    nextSteps: ["Calcular independência financeira", "Ajustar para Tesouro IPCA+", "Proteger patrimônio"],
    recommendations: ["Não pare de aportar ainda", "IPCA+ protege contra inflação"],
    educationTopics: ["Independência financeira", "IPCA+ para renda", "Regra dos 4%"],
  },
  {
    id: "functional-wealth",
    name: "Riqueza Funcional",
    emoji: "👑",
    description: "O milhão foi alcançado. Liberdade financeira real.",
    entryCriteria: ["Patrimônio ≥ R$ 1.000.000", "Renda passiva sustentável"],
    exitCriteria: [],
    commonRisks: ["Lifestyle inflation", "Não proteger patrimônio", "Falta de propósito"],
    priorities: ["Preservar patrimônio", "Viver com propósito", "Ajudar outros"],
    nextSteps: ["Definir próxima meta", "Revisar estilo de vida", "Considerar filantropia"],
    recommendations: ["Você conseguiu! Agora proteja e aproveite", "Revise metas de vida"],
    educationTopics: ["Preservação de patrimônio", "Planejamento sucessório", "Filantropia estratégica"],
  },
];

export function detectCurrentPhase(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): JourneyPhase {
  const diag = calculateDiagnostic(appData, config, monthRecords, startDate);
  const hasFlowData = appData.incomes.length > 0 || appData.expenses.length > 0;
  const activeDebts = appData.debts.filter(d => d.active);
  const toxicDebts = activeDebts.filter(d => d.risk === "toxic" || d.risk === "high");
  const streak = calculateStreak(config, monthRecords, startDate);

  if (!hasFlowData && toxicDebts.length > 0) return "chaos";
  if (!hasFlowData && diag.savingsRate < 0) return "chaos";
  if (diag.emergencyMonths < 3 && diag.savingsRate < 0.1) return "control";
  if (diag.emergencyMonths < 6) return "protection";
  if (diag.investedWealth < 250_000) return "accumulation";
  if (diag.investedWealth < 500_000) return "acceleration";
  if (diag.investedWealth < 750_000) return "consolidation";
  if (diag.investedWealth < 1_000_000) return "passive-income";
  return "functional-wealth";
}

// ===== Advanced Simulator =====

export interface AdvancedScenarioResult {
  label: string;
  monthsToTarget: number | null;
  finalWealth: number;
  passiveIncome4pct: number; // 4% rule monthly
  realWealth: number; // adjusted for inflation
}

export function simulateAdvancedScenario(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string,
  params: {
    currentWealth: number;
    monthlyContribution: number;
    extraContribution: number;
    annualRate: number;
    inflationRate: number;
    months: number;
    skippedMonths: number;
  }
): AdvancedScenarioResult {
  const monthlyRate = Math.pow(1 + params.annualRate, 1 / 12) - 1;
  const monthlyInflation = Math.pow(1 + params.inflationRate, 1 / 12) - 1;
  let balance = params.currentWealth;
  let realBalance = params.currentWealth;
  let targetMonth: number | null = null;
  let skipped = 0;

  for (let i = 0; i < params.months; i++) {
    const deposit = skipped < params.skippedMonths
      ? (skipped++, 0)
      : params.monthlyContribution + params.extraContribution;
    balance = balance * (1 + monthlyRate) + deposit;
    realBalance = realBalance * (1 + monthlyRate - monthlyInflation) + deposit;
    if (targetMonth === null && balance >= 1_000_000) targetMonth = i + 1;
  }

  return {
    label: "",
    monthsToTarget: targetMonth,
    finalWealth: balance,
    passiveIncome4pct: (balance * 0.04) / 12,
    realWealth: realBalance,
  };
}

export function generateScenarioSuite(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string,
  currentWealth: number
): AdvancedScenarioResult[] {
  const monthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const months = config.years * 12;
  const base = { currentWealth, monthlyContribution: monthly, extraContribution: 0, annualRate: config.selicRate, inflationRate: 0.045, months, skippedMonths: 0 };

  return [
    { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, annualRate: 0.08 }), label: "Conservador (8% a.a.)" },
    { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, annualRate: 0.11 }), label: "Moderado (11% a.a.)" },
    { ...simulateAdvancedScenario(config, monthRecords, startDate, base), label: `Atual (${(config.selicRate * 100).toFixed(1)}% a.a.)` },
    { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, monthlyContribution: monthly * 1.2 }), label: "Aporte +20%" },
    { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, monthlyContribution: monthly * 0.8 }), label: "Aporte −20%" },
    { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, skippedMonths: 6 }), label: "6 meses parados" },
    { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, extraContribution: 300 }), label: "Extra +R$ 300/mês" },
    { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, extraContribution: 500, monthlyContribution: monthly * 1.1 }), label: "Cenário otimista" },
  ];
}

// ===== Income Insights =====

export function generateIncomeInsights(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): string[] {
  const insights: string[] = [];
  const monthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const months = config.years * 12;
  const rate = Math.pow(1 + config.selicRate, 1 / 12) - 1;

  // Impact of R$300 extra
  const baseMonths = simulateAdvancedScenario(config, monthRecords, startDate, {
    currentWealth: config.initialAmount, monthlyContribution: monthly, extraContribution: 0,
    annualRate: config.selicRate, inflationRate: 0.045, months, skippedMonths: 0,
  }).monthsToTarget;

  const extra300 = simulateAdvancedScenario(config, monthRecords, startDate, {
    currentWealth: config.initialAmount, monthlyContribution: monthly, extraContribution: 300,
    annualRate: config.selicRate, inflationRate: 0.045, months, skippedMonths: 0,
  }).monthsToTarget;

  if (baseMonths && extra300 && extra300 < baseMonths) {
    insights.push(`Se aumentar o aporte em R$ 300, chega ${baseMonths - extra300} meses antes ao milhão`);
  }

  const cut200 = simulateAdvancedScenario(config, monthRecords, startDate, {
    currentWealth: config.initialAmount, monthlyContribution: monthly + 200, extraContribution: 0,
    annualRate: config.selicRate, inflationRate: 0.045, months, skippedMonths: 0,
  }).monthsToTarget;

  if (baseMonths && cut200 && cut200 < baseMonths) {
    insights.push(`Se cortar R$ 200 e investir, o efeito estimado é chegar ${baseMonths - cut200} meses antes`);
  }

  const extra500 = simulateAdvancedScenario(config, monthRecords, startDate, {
    currentWealth: config.initialAmount, monthlyContribution: monthly + 500, extraContribution: 0,
    annualRate: config.selicRate, inflationRate: 0.045, months, skippedMonths: 0,
  }).monthsToTarget;

  if (baseMonths && extra500 && extra500 < baseMonths) {
    insights.push(`Se elevar a renda em R$ 500, a rota acelera em ${baseMonths - extra500} meses`);
  }

  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const totalExpenses = appData.expenses.reduce((s, e) => s + e.amount, 0);
  if (totalIncome > 0 && totalExpenses > 0) {
    const savingsRate = (totalIncome - totalExpenses) / totalIncome;
    if (savingsRate < 0.15) {
      insights.push("O problema atual está mais ligado ao gasto — foque em reduzir antes de buscar mais renda");
    } else {
      insights.push("Você já tem bom controle de gastos — focar em aumentar renda terá mais impacto");
    }
  }

  return insights;
}

// ===== FGC Alert =====

export function checkFGCAlerts(appData: AppData): { institution: string; balance: number; percentage: number }[] {
  const FGC_LIMIT = 250_000;
  const byInstitution = new Map<string, number>();
  appData.investments.filter(i => i.active && ["cdb", "lci-lca", "poupanca"].includes(i.type)).forEach(i => {
    byInstitution.set(i.institution, (byInstitution.get(i.institution) || 0) + i.currentBalance);
  });
  const alerts: { institution: string; balance: number; percentage: number }[] = [];
  byInstitution.forEach((balance, institution) => {
    const pct = balance / FGC_LIMIT;
    if (pct > 0.7) {
      alerts.push({ institution, balance, percentage: pct });
    }
  });
  return alerts.sort((a, b) => b.percentage - a.percentage);
}

// ===== Patrimonial Architecture Engine =====

export interface BucketDistribution {
  bucket: PatrimonialBucketId;
  label: string;
  description: string;
  balance: number;
  percentage: number;
  status: "healthy" | "attention" | "critical";
  recommendation: string;
  investments: Investment[];
}

export function calculateBucketDistribution(appData: AppData, config: PlanConfig): BucketDistribution[] {
  const activeInvestments = appData.investments.filter(i => i.active);
  const totalWealth = activeInvestments.reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;

  const bucketMap = new Map<PatrimonialBucketId, Investment[]>();
  const bucketIds: PatrimonialBucketId[] = ["reserva", "protecao-bancaria", "base-soberana", "crescimento"];
  bucketIds.forEach(b => bucketMap.set(b, []));

  // Add initial amount as a virtual "tesouro-selic" in reserva
  activeInvestments.forEach(inv => {
    const bucket = inv.bucket || getDefaultBucket(inv.type);
    bucketMap.get(bucket)?.push(inv);
  });

  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const monthlyExpenseEstimate = totalIncome > 0 ? totalIncome * 0.6 : 3000;
  const emergencyTarget = monthlyExpenseEstimate * 6;

  return bucketIds.map(bucketId => {
    const investments = bucketMap.get(bucketId) || [];
    let balance = investments.reduce((s, i) => s + i.currentBalance, 0);
    if (bucketId === "reserva") balance += config.initialAmount;
    const percentage = totalWealth > 0 ? balance / totalWealth : 0;

    let status: "healthy" | "attention" | "critical" = "healthy";
    let recommendation = "";

    if (bucketId === "reserva") {
      if (balance < emergencyTarget * 0.5) {
        status = "critical";
        recommendation = `Sua reserva cobre menos de 3 meses de despesas. Priorize completar pelo menos ${formatBRL(emergencyTarget)} antes de avançar.`;
      } else if (balance < emergencyTarget) {
        status = "attention";
        recommendation = `Faltam ${formatBRL(emergencyTarget - balance)} para completar 6 meses de reserva. Continue priorizando este bucket.`;
      } else {
        recommendation = "Reserva completa. Novos aportes podem ir para outros buckets.";
      }
    } else if (bucketId === "protecao-bancaria") {
      const fgcAlerts = checkFGCAlerts(appData);
      if (fgcAlerts.length > 0) {
        status = "attention";
        recommendation = `${fgcAlerts.length} instituição(ões) próxima(s) do limite FGC. Distribua entre mais instituições.`;
      } else if (balance > 0) {
        recommendation = "Concentração bancária sob controle. Continue monitorando os limites.";
      } else {
        recommendation = "Considere CDBs e LCIs para diversificar com proteção do FGC.";
      }
    } else if (bucketId === "base-soberana") {
      if (totalWealth > 100_000 && balance < totalWealth * 0.2) {
        status = "attention";
        recommendation = "Com seu patrimônio atual, considere ampliar a posição em Tesouro IPCA+ para proteção contra inflação.";
      } else {
        recommendation = "Títulos soberanos protegem contra inflação e são ideais para metas de longo prazo.";
      }
    } else if (bucketId === "crescimento") {
      if (totalWealth < 50_000 && balance > 0) {
        status = "attention";
        recommendation = "Seu patrimônio ainda é pequeno para renda variável. Fortaleça a base antes de diversificar.";
      } else if (totalWealth >= 250_000 && balance < totalWealth * 0.1) {
        recommendation = "Seu patrimônio já comporta uma pequena exposição a ativos de crescimento para diversificação.";
      } else {
        recommendation = "Camada de longo prazo. Avance gradualmente conforme sua base ficar mais sólida.";
      }
    }

    return {
      bucket: bucketId,
      label: BUCKET_LABELS[bucketId],
      description: BUCKET_DESCRIPTIONS[bucketId],
      balance,
      percentage,
      status,
      recommendation,
      investments,
    };
  });
}

// ===== Concentration Risk =====

export interface ConcentrationRisk {
  type: "institution" | "conglomerate" | "asset-class" | "titular";
  name: string;
  balance: number;
  percentage: number;
  limit?: number;
  headroom?: number;
  status: "safe" | "warning" | "danger";
}

export function calculateConcentrationRisks(appData: AppData, config: PlanConfig): ConcentrationRisk[] {
  const activeInvestments = appData.investments.filter(i => i.active);
  const totalWealth = activeInvestments.reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;
  const risks: ConcentrationRisk[] = [];
  const FGC_LIMIT = 250_000;

  // By institution
  const byInstitution = new Map<string, number>();
  activeInvestments.forEach(i => {
    byInstitution.set(i.institution || "Sem instituição", (byInstitution.get(i.institution || "Sem instituição") || 0) + i.currentBalance);
  });
  byInstitution.forEach((balance, institution) => {
    const fgcEligible = activeInvestments
      .filter(i => i.institution === institution && ["cdb", "lci-lca", "poupanca"].includes(i.type))
      .reduce((s, i) => s + i.currentBalance, 0);
    const pct = totalWealth > 0 ? balance / totalWealth : 0;
    const headroom = Math.max(0, FGC_LIMIT - fgcEligible);
    const status = fgcEligible > FGC_LIMIT * 0.9 ? "danger" : fgcEligible > FGC_LIMIT * 0.7 ? "warning" : "safe";
    risks.push({ type: "institution", name: institution, balance, percentage: pct, limit: FGC_LIMIT, headroom, status });
  });

  // By asset class
  const byClass = new Map<string, number>();
  activeInvestments.forEach(i => {
    byClass.set(i.type, (byClass.get(i.type) || 0) + i.currentBalance);
  });
  byClass.forEach((balance, type) => {
    const pct = totalWealth > 0 ? balance / totalWealth : 0;
    const status = pct > 0.6 ? "danger" : pct > 0.4 ? "warning" : "safe";
    risks.push({ type: "asset-class", name: type, balance, percentage: pct, status });
  });

  // By titular
  if (appData.mode === "couple" && appData.partner) {
    const byTitular = new Map<string, number>();
    activeInvestments.forEach(i => {
      const titular = i.titular || i.profileId || appData.primaryProfile.id;
      byTitular.set(titular, (byTitular.get(titular) || 0) + i.currentBalance);
    });
    byTitular.forEach((balance, titularId) => {
      const name = titularId === appData.primaryProfile.id
        ? appData.primaryProfile.name
        : appData.partner?.profile.name || "Parceiro(a)";
      const pct = totalWealth > 0 ? balance / totalWealth : 0;
      const status = pct > 0.8 ? "warning" : "safe";
      risks.push({ type: "titular", name, balance, percentage: pct, status });
    });
  }

  return risks.sort((a, b) => {
    const severity = { danger: 3, warning: 2, safe: 1 };
    return severity[b.status] - severity[a.status];
  });
}

// ===== Portfolio Security Score =====

export interface PortfolioSecurityScore {
  total: number; // 0-100
  protectedPercentage: number; // FGC + soberano
  sovereignPercentage: number;
  fgcPercentage: number;
  marketPercentage: number;
  unprotectedPercentage: number;
  liquidityPercentage: number;
  concentrationLevel: "low" | "medium" | "high";
  overallStatus: "strong" | "moderate" | "fragile";
}

export function calculatePortfolioSecurity(appData: AppData, config: PlanConfig): PortfolioSecurityScore {
  const activeInvestments = appData.investments.filter(i => i.active);
  const totalWealth = activeInvestments.reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;

  const bySecurity = { soberano: config.initialAmount, fgc: 0, mercado: 0, "sem-protecao": 0 } as Record<SecurityLevel, number>;
  activeInvestments.forEach(i => {
    const sec = i.securityLevel || getDefaultSecurity(i.type);
    bySecurity[sec] = (bySecurity[sec] || 0) + i.currentBalance;
  });

  const sovereignPct = totalWealth > 0 ? bySecurity.soberano / totalWealth : 0;
  const fgcPct = totalWealth > 0 ? bySecurity.fgc / totalWealth : 0;
  const marketPct = totalWealth > 0 ? bySecurity.mercado / totalWealth : 0;
  const unprotectedPct = totalWealth > 0 ? bySecurity["sem-protecao"] / totalWealth : 0;
  const protectedPct = sovereignPct + fgcPct;

  // Liquidity
  const liquidAssets = activeInvestments
    .filter(i => !i.maturityDate || new Date(i.maturityDate) <= new Date())
    .reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;
  const liquidityPct = totalWealth > 0 ? liquidAssets / totalWealth : 1;

  // Concentration
  const byInstitution = new Map<string, number>();
  activeInvestments.forEach(i => byInstitution.set(i.institution, (byInstitution.get(i.institution) || 0) + i.currentBalance));
  const maxConcentration = byInstitution.size > 0 ? Math.max(...byInstitution.values()) / Math.max(1, totalWealth) : 0;
  const concentrationLevel = maxConcentration > 0.5 ? "high" : maxConcentration > 0.3 ? "medium" : "low";

  const protectionScore = protectedPct * 40;
  const liquidityScore = liquidityPct * 25;
  const concentrationScore = (1 - maxConcentration) * 20;
  const diversificationScore = Math.min(15, byInstitution.size * 5);
  const total = Math.min(100, Math.round(protectionScore + liquidityScore + concentrationScore + diversificationScore));

  const overallStatus = total >= 70 ? "strong" : total >= 40 ? "moderate" : "fragile";

  return {
    total,
    protectedPercentage: protectedPct,
    sovereignPercentage: sovereignPct,
    fgcPercentage: fgcPct,
    marketPercentage: marketPct,
    unprotectedPercentage: unprotectedPct,
    liquidityPercentage: liquidityPct,
    concentrationLevel,
    overallStatus,
  };
}

// ===== Realistic Projection (Nominal, Net, Real) =====

export interface RealisticProjectionRow {
  month: number;
  nominal: number;
  net: number; // after estimated taxes
  real: number; // inflation-adjusted
}

export function generateRealisticProjection(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string,
  inflationRate: number = 0.045,
  taxRate: number = 0.15 // simplified average IR
): RealisticProjectionRow[] {
  const projection = generateProjection(config, "planned", monthRecords, startDate);
  const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12) - 1;

  return projection.map((row, i) => {
    const gains = row.totalInterest;
    const taxOnGains = gains * taxRate;
    const net = row.totalBalance - taxOnGains;
    const deflator = Math.pow(1 + monthlyInflation, i + 1);
    const real = row.totalBalance / deflator;

    return {
      month: row.monthIndex,
      nominal: row.totalBalance,
      net: Math.max(0, net),
      real,
    };
  });
}

// ===== Structural Alerts =====

export interface StructuralAlert {
  id: string;
  severity: "info" | "warning" | "danger";
  icon: string;
  title: string;
  description: string;
  action: string;
  category: "concentration" | "protection" | "liquidity" | "projection" | "structure";
}

export function generateStructuralAlerts(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): StructuralAlert[] {
  const alerts: StructuralAlert[] = [];
  const security = calculatePortfolioSecurity(appData, config);
  const buckets = calculateBucketDistribution(appData, config);
  const concentrations = calculateConcentrationRisks(appData, config);
  const totalWealth = appData.investments.filter(i => i.active).reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;

  // Reserva insuficiente
  const reservaBucket = buckets.find(b => b.bucket === "reserva");
  if (reservaBucket && reservaBucket.status === "critical") {
    alerts.push({
      id: "reserva-critica",
      severity: "danger",
      icon: "🚨",
      title: "Reserva de emergência insuficiente",
      description: "Sem uma reserva adequada, qualquer imprevisto pode comprometer seus investimentos. Esse é o alicerce de tudo.",
      action: "Priorize completar pelo menos 3 meses de despesas em liquidez diária.",
      category: "protection",
    });
  }

  // FGC danger
  const fgcDangers = concentrations.filter(c => c.type === "institution" && c.status === "danger");
  fgcDangers.forEach(c => {
    alerts.push({
      id: `fgc-${c.name}`,
      severity: "danger",
      icon: "⚠️",
      title: `Limite FGC quase atingido em ${c.name}`,
      description: `Você tem ${formatBRL(c.balance)} em ${c.name}. O FGC protege até R$ 250 mil por instituição. Acima disso, você perde a garantia.`,
      action: "Distribua o excedente para outra instituição antes de fazer novos aportes aqui.",
      category: "concentration",
    });
  });

  // High concentration in single institution
  const highConcentration = concentrations.find(c => c.type === "institution" && c.percentage > 0.6);
  if (highConcentration) {
    alerts.push({
      id: "concentration-high",
      severity: "warning",
      icon: "📊",
      title: "Concentração alta em uma única instituição",
      description: `${(highConcentration.percentage * 100).toFixed(0)}% do patrimônio está em ${highConcentration.name}. Isso cria um risco invisível.`,
      action: "Considere diversificar entre pelo menos 2-3 instituições diferentes.",
      category: "concentration",
    });
  }

  // Low liquidity
  if (security.liquidityPercentage < 0.3 && totalWealth > 10_000) {
    alerts.push({
      id: "low-liquidity",
      severity: "warning",
      icon: "💧",
      title: "Baixa liquidez na carteira",
      description: `Apenas ${(security.liquidityPercentage * 100).toFixed(0)}% do patrimônio tem liquidez imediata. Em uma emergência, você pode precisar vender ativos com prejuízo.`,
      action: "Mantenha pelo menos 30% do patrimônio em ativos com liquidez diária.",
      category: "liquidity",
    });
  }

  // Growing without protection
  if (totalWealth > 50_000 && security.protectedPercentage < 0.5) {
    alerts.push({
      id: "low-protection",
      severity: "warning",
      icon: "🛡️",
      title: "Patrimônio crescendo sem proteção suficiente",
      description: `Apenas ${(security.protectedPercentage * 100).toFixed(0)}% do patrimônio tem proteção (FGC ou soberana). O restante está exposto ao risco de mercado.`,
      action: "Reforce a base com Tesouro Direto ou CDBs antes de expandir em risco.",
      category: "protection",
    });
  }

  // Nominal vs Real projection gap
  if (totalWealth > 0) {
    const realProjection = generateRealisticProjection(config, monthRecords, startDate);
    const lastRow = realProjection[realProjection.length - 1];
    if (lastRow && lastRow.nominal > 0) {
      const realGap = ((lastRow.nominal - lastRow.real) / lastRow.nominal) * 100;
      if (realGap > 30) {
        alerts.push({
          id: "inflation-gap",
          severity: "info",
          icon: "📉",
          title: "A inflação vai corroer parte do seu ganho",
          description: `Sua projeção nominal é ${formatBRL(lastRow.nominal)}, mas em poder de compra real será ~${formatBRL(lastRow.real)}. A diferença de ${realGap.toFixed(0)}% é o efeito da inflação ao longo do tempo.`,
          action: "Considere aumentar a exposição a Tesouro IPCA+ para proteger o poder de compra.",
          category: "projection",
        });
      }
    }
  }

  // Couple governance - imbalance
  if (appData.mode === "couple" && appData.partner) {
    const titularRisks = concentrations.filter(c => c.type === "titular");
    const imbalanced = titularRisks.find(c => c.percentage > 0.8);
    if (imbalanced) {
      alerts.push({
        id: "titular-imbalance",
        severity: "info",
        icon: "👥",
        title: "Patrimônio muito concentrado em um titular",
        description: `${(imbalanced.percentage * 100).toFixed(0)}% do patrimônio está no nome de ${imbalanced.name}. Distribuir entre os dois titulares amplia a proteção do FGC.`,
        action: "Considere abrir contas no nome do(a) parceiro(a) para distribuir melhor.",
        category: "structure",
      });
    }
  }

  return alerts.sort((a, b) => {
    const sev = { danger: 3, warning: 2, info: 1 };
    return sev[b.severity] - sev[a.severity];
  });
}

// ===== Next Best Action =====

export function getNextBestAction(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): { action: string; reason: string; bucket: PatrimonialBucketId } {
  const isCouple = config.contributors.length > 1;
  const sua = isCouple ? "a" : "sua";
  const voce = isCouple ? "Vocês estão perto" : "Você está perto";
  const buckets = calculateBucketDistribution(appData, config);
  const reserva = buckets.find(b => b.bucket === "reserva")!;
  const alerts = generateStructuralAlerts(appData, config, monthRecords, startDate);

  // Priority 1: Emergency fund
  if (reserva.status === "critical") {
    return {
      action: isCouple ? "Completem a reserva de emergência" : "Complete sua reserva de emergência",
      reason: "Sem reserva, qualquer imprevisto pode comprometer todo o plano.",
      bucket: "reserva",
    };
  }

  // Priority 2: FGC alerts
  const fgcAlert = alerts.find(a => a.category === "concentration" && a.severity === "danger");
  if (fgcAlert) {
    return {
      action: "Distribua entre instituições",
      reason: `${voce} do limite do FGC. Proteja o que já conquistou.`,
      bucket: "protecao-bancaria",
    };
  }

  // Priority 3: Finish reserva
  if (reserva.status === "attention") {
    return {
      action: isCouple ? "Finalizem a reserva de emergência" : "Finalize sua reserva de emergência",
      reason: "Quase lá. Completar 6 meses dá segurança para investir com mais tranquilidade.",
      bucket: "reserva",
    };
  }

  // Priority 4: Diversify
  const totalWealth = appData.investments.filter(i => i.active).reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;
  if (totalWealth > 100_000) {
    const soberana = buckets.find(b => b.bucket === "base-soberana")!;
    if (soberana.percentage < 0.2) {
      return {
        action: isCouple ? "Expandam a base soberana" : "Expanda sua base soberana",
        reason: "Com patrimônio acima de R$ 100k, Tesouro IPCA+ protege contra inflação no longo prazo.",
        bucket: "base-soberana",
      };
    }
  }

  // Default: keep accumulating
  return {
    action: isCouple ? "Continuem os aportes mensais" : "Continue seus aportes mensais",
    reason: isCouple ? "A estrutura está equilibrada. Consistência é o que mais acelera o resultado." : "Sua estrutura está equilibrada. Consistência é o que mais acelera o resultado.",
    bucket: "protecao-bancaria",
  };
}
