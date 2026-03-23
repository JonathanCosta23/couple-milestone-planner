/**
 * Behavioral Intelligence Engine — Plano do Milhão V8
 * Nudges, habit tracking, discipline scoring, and scam detection.
 */

import { AppData, ExpenseCategory } from "./models";
import { PlanConfig, MonthRecord, getCurrentMonthKey } from "./types";
import { calculateStreak } from "./calculator";

// ===== Behavioral Nudges =====

export interface BehavioralNudge {
  id: string;
  message: string;
  type: "warning" | "insight" | "praise" | "action";
  icon: string;
  priority: number; // higher = more important
}

export function generateNudges(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): BehavioralNudge[] {
  const nudges: BehavioralNudge[] = [];
  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const currentKey = getCurrentMonthKey();
  const monthExp = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExp.reduce((s, e) => s + e.amount, 0);
  const activeDebts = appData.debts.filter(d => d.active);
  const totalDebtPayment = activeDebts.reduce((s, d) => s + d.monthlyPayment, 0);
  const investments = appData.investments.filter(i => i.active);
  const totalInvested = investments.reduce((s, i) => s + i.currentBalance, 0);
  const streak = calculateStreak(config, monthRecords, startDate);
  const monthlyContrib = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);

  // Small recurring purchases (subscriptions)
  const subscriptions = monthExp.filter(e => e.category === "assinaturas");
  const subTotal = subscriptions.reduce((s, e) => s + e.amount, 0);
  if (subTotal > totalIncome * 0.05 && totalIncome > 0) {
    nudges.push({
      id: "sub-leak", message: `Suas assinaturas somam R$ ${subTotal.toFixed(0)}/mês. Pequenos valores recorrentes se acumulam — revise quais realmente usa.`,
      type: "warning", icon: "📱", priority: 70,
    });
  }

  // Card as income extension
  const cardExp = monthExp.filter(e => e.category === "cartao").reduce((s, e) => s + e.amount, 0);
  if (totalIncome > 0 && cardExp > totalIncome * 0.4) {
    nudges.push({
      id: "card-income", message: "Seu cartão está funcionando como extensão de renda — os gastos no cartão ultrapassam 40% da sua receita.",
      type: "warning", icon: "💳", priority: 85,
    });
  }

  // Investing without cash buffer
  const emergencyAssets = investments.filter(i => ["tesouro-selic", "poupanca"].includes(i.type)).reduce((s, i) => s + i.currentBalance, 0);
  const expEstimate = totalExpenses > 0 ? totalExpenses : totalIncome * 0.6;
  const emergencyMonths = expEstimate > 0 ? emergencyAssets / expEstimate : 0;
  if (monthlyContrib > 0 && emergencyMonths < 3) {
    nudges.push({
      id: "no-buffer", message: "Você está investindo sem ter caixa de emergência suficiente. Priorize montar pelo menos 3 meses de reserva.",
      type: "warning", icon: "🚨", priority: 90,
    });
  }

  // Concentration
  const byInstitution = new Map<string, number>();
  investments.forEach(i => byInstitution.set(i.institution, (byInstitution.get(i.institution) || 0) + i.currentBalance));
  const maxConc = totalInvested > 0 ? Math.max(...byInstitution.values()) / totalInvested : 0;
  if (maxConc > 0.8 && totalInvested > 50000) {
    nudges.push({
      id: "concentration", message: "Seu patrimônio está concentrado demais em uma instituição. Diversifique para reduzir risco.",
      type: "warning", icon: "⚠️", priority: 75,
    });
  }

  // Projecting without considering contingencies
  if (monthlyContrib > totalIncome * 0.4 && totalIncome > 0) {
    nudges.push({
      id: "overproject", message: "Você está projetando aportes acima de 40% da renda — considere imprevistos antes de se comprometer tanto.",
      type: "insight", icon: "🎯", priority: 60,
    });
  }

  // Discipline improved
  if (streak >= 3) {
    nudges.push({
      id: "discipline-up", message: `Sua disciplina melhorou: ${streak} meses consecutivos de aporte. Continue assim!`,
      type: "praise", icon: "🔥", priority: 50,
    });
  }

  // Discipline dropped
  if (streak === 0 && monthRecords.length > 3) {
    nudges.push({
      id: "discipline-down", message: "Sua sequência de aportes foi quebrada. Volte a aportar este mês para não perder o ritmo.",
      type: "warning", icon: "📉", priority: 80,
    });
  }

  // Idle money
  const poupanca = investments.filter(i => i.type === "poupanca").reduce((s, i) => s + i.currentBalance, 0);
  if (poupanca > 10000) {
    nudges.push({
      id: "idle-money", message: `Você tem R$ ${poupanca.toFixed(0)} na poupança. Considere migrar para Tesouro Selic para render mais com a mesma segurança.`,
      type: "action", icon: "💤", priority: 65,
    });
  }

  // Excessive risk
  const riskyAssets = investments.filter(i => ["acao", "crypto", "fii"].includes(i.type)).reduce((s, i) => s + i.currentBalance, 0);
  if (totalInvested > 0 && riskyAssets / totalInvested > 0.5 && totalInvested < 100000) {
    nudges.push({
      id: "high-risk", message: "Mais de 50% do seu patrimônio está em ativos de risco. Com patrimônio menor, foque em renda fixa primeiro.",
      type: "warning", icon: "⚡", priority: 80,
    });
  }

  return nudges.sort((a, b) => b.priority - a.priority);
}

// ===== Habit Tracker =====

export interface HabitMetrics {
  contributionStreak: number;
  monthlyDiscipline: number; // 0-100
  expenseTracking: number; // 0-100 (how well they track)
  cardControl: number; // 0-100
  impulseFreedays: number; // estimated
  overallDiscipline: number; // 0-100
  trend: "improving" | "stable" | "declining";
}

export function calculateHabitMetrics(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): HabitMetrics {
  const streak = calculateStreak(config, monthRecords, startDate);
  const currentKey = getCurrentMonthKey();
  const monthExp = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const totalExpenses = monthExp.reduce((s, e) => s + e.amount, 0);
  const cardExp = monthExp.filter(e => e.category === "cartao").reduce((s, e) => s + e.amount, 0);
  const impulsiveExp = monthExp.filter(e => e.priority === "optional" && e.type === "variable");

  // Contribution streak score
  const contributionStreak = streak;

  // Monthly discipline: savings rate based
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;
  const monthlyDiscipline = Math.min(100, Math.max(0, savingsRate * 250));

  // Expense tracking
  const hasExpenses = monthExp.length > 0;
  const hasIncomes = appData.incomes.length > 0;
  const expenseTracking = (hasExpenses ? 60 : 0) + (hasIncomes ? 40 : 0);

  // Card control
  const cardRatio = totalExpenses > 0 ? cardExp / totalExpenses : 0;
  const cardControl = Math.max(0, 100 - cardRatio * 200);

  // Impulse-free estimation
  const impulseDays = Math.max(0, 30 - impulsiveExp.length * 3);

  // Overall
  const overallDiscipline = Math.round(
    monthlyDiscipline * 0.3 +
    Math.min(100, streak * 12) * 0.25 +
    expenseTracking * 0.2 +
    cardControl * 0.25
  );

  // Trend
  const prevKey = getPrevMonthKey(currentKey);
  const prevExp = appData.expenses.filter(e => e.monthKey === prevKey);
  const prevTotal = prevExp.reduce((s, e) => s + e.amount, 0);
  let trend: "improving" | "stable" | "declining" = "stable";
  if (prevTotal > 0 && totalExpenses > 0) {
    if (totalExpenses < prevTotal * 0.95) trend = "improving";
    else if (totalExpenses > prevTotal * 1.05) trend = "declining";
  }

  return {
    contributionStreak: streak,
    monthlyDiscipline,
    expenseTracking,
    cardControl,
    impulseFreedays: impulseDays,
    overallDiscipline,
    trend,
  };
}

function getPrevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ===== Scam / Trap Detector =====

export interface TrapCheckResult {
  score: number; // 0-100, higher = more suspicious
  flags: { label: string; triggered: boolean; weight: number }[];
  verdict: "safe" | "caution" | "danger" | "scam";
  summary: string;
}

export const TRAP_CHECKLIST = [
  { id: "high-return", label: "Promessa de retorno alto demais (> 2% ao mês)", weight: 15 },
  { id: "urgency", label: "Urgência emocional para decidir rápido", weight: 12 },
  { id: "social-pressure", label: "Pressão social ou FOMO", weight: 10 },
  { id: "no-explanation", label: "Falta de explicação clara de como funciona", weight: 14 },
  { id: "complexity", label: "Complexidade desnecessária no modelo", weight: 8 },
  { id: "no-liquidity", label: "Ausência de informação sobre liquidez", weight: 12 },
  { id: "guaranteed-income", label: "Promessa de renda garantida sem risco", weight: 15 },
  { id: "influencer-only", label: "Recomendação baseada só em influencer", weight: 8 },
  { id: "obscure-platform", label: "Plataforma obscura ou sem regulação", weight: 13 },
  { id: "no-logic", label: "Falta de lógica econômica no retorno", weight: 13 },
] as const;

export function evaluateTrap(checkedIds: string[]): TrapCheckResult {
  const flags = TRAP_CHECKLIST.map(item => ({
    label: item.label,
    triggered: checkedIds.includes(item.id),
    weight: item.weight,
  }));

  const score = flags.filter(f => f.triggered).reduce((s, f) => s + f.weight, 0);
  const maxScore = flags.reduce((s, f) => s + f.weight, 0);
  const pct = (score / maxScore) * 100;

  let verdict: TrapCheckResult["verdict"] = "safe";
  let summary = "Parece seguro. Mas sempre pesquise mais antes de investir.";

  if (pct >= 70) {
    verdict = "scam";
    summary = "Alto risco de fraude! Muitos sinais de alerta foram acionados. Evite.";
  } else if (pct >= 45) {
    verdict = "danger";
    summary = "Muitos sinais de alerta. Pesquise bastante antes de seguir. Provavelmente não vale o risco.";
  } else if (pct >= 20) {
    verdict = "caution";
    summary = "Alguns sinais de alerta. Investigue mais a fundo antes de tomar qualquer decisão.";
  }

  return { score: Math.round(pct), flags, verdict, summary };
}

// ===== Mentorship Recommendations =====

export interface MentorRecommendation {
  icon: string;
  title: string;
  description: string;
  type: "cut" | "increase" | "accelerate" | "fix" | "learn";
  priority: number;
}

export function generateMentorRecommendations(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): MentorRecommendation[] {
  const recs: MentorRecommendation[] = [];
  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const currentKey = getCurrentMonthKey();
  const monthExp = appData.expenses.filter(e => e.monthKey === currentKey);
  const totalExpenses = monthExp.reduce((s, e) => s + e.amount, 0);
  const activeDebts = appData.debts.filter(d => d.active);
  const totalDebt = activeDebts.reduce((s, d) => s + d.monthlyPayment, 0);
  const toxicDebts = activeDebts.filter(d => d.risk === "toxic" || d.risk === "high");
  const investments = appData.investments.filter(i => i.active);
  const totalInvested = investments.reduce((s, i) => s + i.currentBalance, 0);
  const emergencyAssets = investments.filter(i => ["tesouro-selic", "poupanca"].includes(i.type)).reduce((s, i) => s + i.currentBalance, 0);
  const expEstimate = totalExpenses > 0 ? totalExpenses : totalIncome * 0.6;
  const emergencyMonths = expEstimate > 0 ? emergencyAssets / expEstimate : 0;

  // Biggest risk
  if (toxicDebts.length > 0) {
    recs.push({
      icon: "🚨", title: "Quitar dívidas tóxicas",
      description: `Você tem ${toxicDebts.length} dívida(s) de alto risco. Priorize quitar antes de investir.`,
      type: "fix", priority: 95,
    });
  }

  // Emergency fund
  if (emergencyMonths < 3) {
    recs.push({
      icon: "🛡️", title: "Completar reserva de emergência",
      description: `Sua reserva cobre apenas ${emergencyMonths.toFixed(1)} meses. Meta: 6 meses em Tesouro Selic.`,
      type: "fix", priority: 90,
    });
  }

  // Cut spending
  const varExpenses = monthExp.filter(e => e.type === "variable").reduce((s, e) => s + e.amount, 0);
  if (totalIncome > 0 && varExpenses > totalIncome * 0.3) {
    recs.push({
      icon: "✂️", title: "Cortar gastos variáveis",
      description: "Seus gastos variáveis passam de 30% da renda. Identifique onde economizar.",
      type: "cut", priority: 70,
    });
  }

  // Increase contribution
  const monthlyContrib = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  if (totalIncome > 0 && monthlyContrib / totalIncome < 0.15 && emergencyMonths >= 3) {
    recs.push({
      icon: "📈", title: "Aumentar aporte mensal",
      description: "Você investe menos de 15% da renda. Tente subir gradualmente para acelerar o plano.",
      type: "increase", priority: 65,
    });
  }

  // Increase income
  if (totalIncome > 0 && totalIncome < 5000) {
    recs.push({
      icon: "💰", title: "Buscar aumento de renda",
      description: "Com renda abaixo de R$ 5 mil, o aumento de receita terá mais impacto que corte de gastos.",
      type: "increase", priority: 60,
    });
  }

  // Accelerate phase
  if (emergencyMonths >= 6 && toxicDebts.length === 0) {
    recs.push({
      icon: "🚀", title: "Acelerar acumulação",
      description: "Reserva completa e sem dívidas tóxicas — momento de focar em crescimento patrimonial.",
      type: "accelerate", priority: 55,
    });
  }

  // Learn
  if (appData.educationalProgress.completedLessons.length < 3) {
    recs.push({
      icon: "📚", title: "Estudar investimentos",
      description: "Você ainda tem lições por completar. Conhecimento é seu maior ativo.",
      type: "learn", priority: 40,
    });
  }

  // What's blocking evolution
  if (totalIncome === 0) {
    recs.push({
      icon: "⚡", title: "Cadastrar receitas",
      description: "Sem receitas cadastradas, o app não pode gerar recomendações precisas.",
      type: "fix", priority: 100,
    });
  }

  return recs.sort((a, b) => b.priority - a.priority);
}
