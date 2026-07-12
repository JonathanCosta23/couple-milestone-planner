/**
 * Tipos do motor de Próxima Melhor Ação (NBA).
 * Determinístico, sem recomendação financeira individualizada.
 */

export const NBA_ENGINE_VERSION = "nba-v1";

export type NextActionCategory =
  | "data_quality"
  | "security"
  | "debt"
  | "budget"
  | "emergency_fund"
  | "monthly_execution"
  | "fgc"
  | "concentration"
  | "liquidity"
  | "projection"
  | "assumptions"
  | "asset_education"
  | "learning"
  | "review"
  | "celebration";

export type NextActionSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

export type NextActionConfidence =
  | "high"
  | "medium"
  | "low"
  | "insufficient_data";

export interface NextActionDestination {
  tab: string;
  sub?: string;
}

export interface NextActionEvidence {
  label: string;
  value?: string;
}

export interface NextBestAction {
  id: string;
  /** Chave estável (ex.: "debt:review:<id>", "reserve:gap:<planId>"). */
  actionKey: string;
  category: NextActionCategory;
  priority: number; // 1 = mais alta
  severity: NextActionSeverity;
  title: string;
  description: string;
  reason: string;
  evidence: NextActionEvidence[];
  calculationSummary?: string;
  riskIfIgnored: string;
  ctaLabel: string;
  destination: NextActionDestination;
  completionCriteria: string;
  educationalTopicId?: string;
  confidence: NextActionConfidence;
  missingData?: string[];
  expiresAt?: string;
  generatedAt: string;
  engineVersion: string;
}

export interface NextActionCandidate extends Omit<NextBestAction, "id" | "generatedAt" | "engineVersion"> {
  /** Score interno para desempate. Não exibido ao usuário. */
  score: number;
}

export type UserActionStatus =
  | "active"
  | "snoozed"
  | "dismissed"
  | "completed"
  | "not_applicable"
  | "expired";

export interface UserActionState {
  actionKey: string;
  status: UserActionStatus;
  snoozedUntil?: string | null;
  dismissedReason?: string | null;
  completedAt?: string | null;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export type UserLearningLevel = "beginner" | "basic" | "intermediate" | "advanced";

export interface NextActionContext {
  /** Data-relógio (permite testes determinísticos). */
  now: Date;
  planId: string | null;
  hasCoreDataLoaded: boolean;
  /** Dados do módulo financeiro (metrics + flags). */
  metrics: {
    totalIncome: number;
    totalExpenses: number;
    essentialExpenses: number;
    savingsRate: number;
    monthlyContribution: number;
    reserveMonths: number;
    reserveGoalMonths: number;
    reserveGap: number;
    grossWealth: number;
    toxicDebtCount: number;
    debtWeight: number;
    maxConcentrationByInstitution: number;
    concentrationInstitution: string;
  };
  hasBudgetData: boolean;
  hasIncomeData: boolean;
  hasExpenseData: boolean;
  /** Ordem estável de dívidas ativas (ordenadas por chave estável). */
  debts: Array<{
    id: string;
    label: string;
    monthlyPayment: number;
    interestRateAnnual?: number | null;
    risk: string;
    active: boolean;
  }>;
  /** Chave do mês atual (YYYY-MM). */
  currentMonthKey: string;
  currentMonthPlanned: number;
  currentMonthActual: number;
  currentMonthCompleted: boolean;
  /** Sinal opcional do motor FGC. */
  fgc?: {
    officialExcess: number;
    prudentialExcess: number;
    hasPendingClassification: boolean;
    hasPendingInstitution: boolean;
  };
  learningLevel: UserLearningLevel;
  /** Estados persistidos por action_key. */
  storedStates: Map<string, UserActionState>;
}

export interface RankedResult {
  primary: NextBestAction | null;
  secondary: NextBestAction | null;
  all: NextBestAction[];
}