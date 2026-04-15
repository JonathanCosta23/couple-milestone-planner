export interface Contributor {
  name: string;
  plannedSelic: number;
  plannedCDB: number;
  age?: number;
}

export interface PlanConfig {
  initialAmount: number;
  targetAmount: number;
  years: number;
  selicRate: number;
  cdbRate: number;
  contributors: Contributor[];
}

export interface MonthDeposit {
  actualSelic: number;
  actualCDB: number;
}

export interface MonthRecord {
  monthKey: string;
  deposits: MonthDeposit[];
  notes: string;
  completed?: boolean;
}

export type MonthStatus = "pending" | "partial" | "completed";

export interface ProjectionRow {
  monthIndex: number;
  date: string;
  selicBalance: number;
  cdbBalance: number;
  totalBalance: number;
  totalDeposited: number;
  totalInterest: number;
  depositThisMonth: number;
}

export interface FinancialProfile {
  incomePrimary?: number;
  incomePartner?: number;
  /** @deprecated Use incomePrimary. Kept for legacy migration. */
  incomeJonathan?: number;
  /** @deprecated Use incomePartner. Kept for legacy migration. */
  incomeIsabella?: number;
  monthlyExpenses?: number;
  emergencyFund?: number;
}

export type EmotionalGoal =
  | "liberdade-financeira"
  | "casa-propria"
  | "aposentadoria"
  | "viagens"
  | "familia"
  | "outro";

export const EMOTIONAL_GOAL_LABELS: Record<EmotionalGoal, string> = {
  "liberdade-financeira": "Liberdade financeira",
  "casa-propria": "Casa própria",
  "aposentadoria": "Aposentadoria",
  "viagens": "Viagens",
  "familia": "Família",
  "outro": "Outro",
};

export const CURRENT_SCHEMA_VERSION = "6.1.0";

export interface PlanDataExportMeta {
  schemaVersion: string;
  exportedAt: string;
  planStart?: string;
  planEnd?: string;
}

export interface PlanData {
  schemaVersion?: string;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  wizardComplete: boolean;
  startDate: string;
  notificationSettings?: {
    monthlyReminder: boolean;
    annualReview: boolean;
  };
  financialProfile?: FinancialProfile;
  emotionalGoal?: EmotionalGoal;
  emotionalGoalCustom?: string;
  onboardingComplete?: boolean;
}

export const MILESTONES = [50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000];

export const DEFAULT_CONFIG: PlanConfig = {
  initialAmount: 9_000,
  targetAmount: 1_000_000,
  years: 21,
  selicRate: 0.1315,
  cdbRate: 1.0,
  contributors: [
    { name: "", plannedSelic: 1_000, plannedCDB: 500, age: 25 },
  ],
};

export const PLAN_START = "2026-01";
export const PLAN_END = "2046-12";
export const PLAN_MONTHS = 252;

export const EMPTY_DEPOSIT: MonthDeposit = { actualSelic: 0, actualCDB: 0 };

export const MOTIVATIONAL_MESSAGES_SOLO = [
  "Você está no caminho certo ❤️",
  "Últimos meses foram consistentes! 🔥",
  "Pequenos aportes, grandes resultados. 🌱",
  "O poder dos juros compostos está com você! 📈",
  "Cada mês conta. Você está construindo o futuro! 💪",
  "Consistência é o segredo do milhão! 🎯",
  "Disciplina é o que separa sonho de meta! 🚀",
  "O hábito de investir já está formado! 🏆",
];

export const MOTIVATIONAL_MESSAGES_COUPLE = [
  "Vocês estão no caminho certo ❤️",
  "Últimos meses foram consistentes! 🔥",
  "Pequenos aportes, grandes resultados. 🌱",
  "O poder dos juros compostos está com vocês! 📈",
  "Cada mês conta. Vocês estão construindo o futuro! 💪",
  "Consistência é o segredo do milhão! 🎯",
  "Juntos vocês vão mais longe! 🚀",
  "O hábito de investir já está formado! 🏆",
];

export function getMotivationalMessages(isCouple: boolean): string[] {
  return isCouple ? MOTIVATIONAL_MESSAGES_COUPLE : MOTIVATIONAL_MESSAGES_SOLO;
}

/** @deprecated Use getMotivationalMessages(isCouple) instead */
export const MOTIVATIONAL_MESSAGES = MOTIVATIONAL_MESSAGES_COUPLE;

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBRLCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return formatBRL(value);
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

export function monthKeyToFullLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[parseInt(m) - 1]} de ${y}`;
}

export function generateMonthKeys(startDate: string, count: number): string[] {
  const [sy, sm] = startDate.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = ((sm - 1 + i) % 12) + 1;
    const y = sy + Math.floor((sm - 1 + i) / 12);
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return keys;
}

export function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}
