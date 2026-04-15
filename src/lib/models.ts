/**
 * V7 Entity Models — Plano do Milhão
 * All financial planning entities for solo/couple mode.
 * These extend the existing PlanData without breaking backward compatibility.
 */

// ===== Core Identity =====

export type PlanMode = "solo" | "couple";

export interface Profile {
  id: string;
  name: string;
  age?: number;
  email?: string;
  avatarColor?: string;
}

export interface Partner {
  profile: Profile;
  addedAt: string;
  removedAt?: string; // soft-delete to preserve history
}

// ===== Income =====

export interface Income {
  id: string;
  profileId: string;
  label: string;
  amount: number;
  type: "salary" | "freelance" | "rental" | "dividends" | "bonus" | "other";
  recurrence: "monthly" | "biweekly" | "weekly" | "yearly" | "one-time";
  active: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

// ===== Expenses =====

export type ExpenseCategory =
  | "moradia"
  | "alimentacao"
  | "transporte"
  | "saude"
  | "estudos"
  | "cartao"
  | "dividas"
  | "assinaturas"
  | "lazer"
  | "investimento"
  | "familia"
  | "pets"
  | "trabalho"
  | "outros";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  moradia: "Moradia",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude: "Saúde",
  estudos: "Estudos",
  cartao: "Cartão",
  dividas: "Dívidas",
  assinaturas: "Assinaturas",
  lazer: "Lazer",
  investimento: "Investimento",
  familia: "Família",
  pets: "Pets",
  trabalho: "Trabalho",
  outros: "Outros",
};

export const EXPENSE_CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  moradia: "🏠",
  alimentacao: "🍽️",
  transporte: "🚗",
  saude: "💊",
  estudos: "📚",
  cartao: "💳",
  dividas: "📋",
  assinaturas: "📱",
  lazer: "🎮",
  investimento: "📈",
  familia: "👨‍👩‍👧",
  pets: "🐾",
  trabalho: "💼",
  outros: "📦",
};

export type ExpenseType = "fixed" | "variable";
export type ExpenseOwnership = "individual" | "shared";
export type ExpenseStatus = "pending" | "paid" | "overdue" | "cancelled";
export type ExpensePriority = "essential" | "important" | "optional";

export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  subcategory?: string;
  type: ExpenseType;
  recurrence: "one-time" | "monthly" | "weekly" | "yearly";
  status: ExpenseStatus;
  ownership: ExpenseOwnership;
  responsibleProfileId?: string; // who pays in couple mode
  dueDate?: string; // YYYY-MM-DD
  paidDate?: string;
  notes?: string;
  priority: ExpensePriority;
  budgetImpact?: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  monthKey: string; // YYYY-MM for which month this expense belongs to
  isRecurringSource?: boolean; // true if this is the "template" for recurring
  recurringSourceId?: string; // references the source expense if generated from recurrence
}

// ===== Recurring Expenses (Templates) =====

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  subcategory?: string;
  type: ExpenseType;
  ownership: ExpenseOwnership;
  responsibleProfileId?: string;
  dayOfMonth?: number;
  priority: ExpensePriority;
  active: boolean;
  startDate: string; // YYYY-MM
  endDate?: string;
  notes?: string;
  createdAt: string;
}

// ===== Debts =====

export type DebtType = "credit-card" | "loan" | "financing" | "informal" | "recurring-bill" | "installment";
export type DebtRisk = "low" | "medium" | "high" | "toxic";

export interface Debt {
  id: string;
  name: string;
  type: DebtType;
  totalAmount: number;
  currentInstallment: number;
  totalInstallments: number;
  monthlyPayment: number;
  interestRate: number; // annual
  dueDay: number;
  creditor?: string;
  risk: DebtRisk;
  payoffPriority: number; // 1 = highest
  notes?: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  profileId?: string; // whose debt
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  debtId: string;
  monthKey: string;
  amount: number;
  paid: boolean;
  paidDate?: string;
  installmentNumber: number;
}

// ===== Investments =====

export type InvestmentType = "tesouro-selic" | "cdb" | "lci-lca" | "fundo" | "acao" | "fii" | "crypto" | "poupanca" | "other";

export type SecurityLevel = "soberano" | "fgc" | "mercado" | "sem-protecao";

export type PatrimonialBucketId = "reserva" | "protecao-bancaria" | "base-soberana" | "crescimento";

export const SECURITY_LEVEL_LABELS: Record<SecurityLevel, string> = {
  "soberano": "Garantia Soberana",
  "fgc": "Protegido pelo FGC",
  "mercado": "Risco de Mercado",
  "sem-protecao": "Sem Proteção Específica",
};

export const BUCKET_LABELS: Record<PatrimonialBucketId, string> = {
  "reserva": "Reserva e Liquidez",
  "protecao-bancaria": "Proteção Bancária",
  "base-soberana": "Base Soberana",
  "crescimento": "Crescimento e Diversificação",
};

export const BUCKET_DESCRIPTIONS: Record<PatrimonialBucketId, string> = {
  "reserva": "Emergência, curto prazo e estabilidade operacional",
  "protecao-bancaria": "Acumulação com controle de concentração por instituição",
  "base-soberana": "Expansão com segurança soberana e proteção contra inflação",
  "crescimento": "Diversificação de longo prazo para patrimônios mais maduros",
};

// Map investment types to default security and bucket
export function getDefaultSecurity(type: InvestmentType): SecurityLevel {
  switch (type) {
    case "tesouro-selic": return "soberano";
    case "cdb": case "lci-lca": case "poupanca": return "fgc";
    case "fundo": case "acao": case "fii": case "crypto": return "mercado";
    default: return "sem-protecao";
  }
}

export function getDefaultBucket(type: InvestmentType): PatrimonialBucketId {
  switch (type) {
    case "tesouro-selic": case "poupanca": return "reserva";
    case "cdb": case "lci-lca": return "protecao-bancaria";
    case "fundo": return "base-soberana";
    case "acao": case "fii": case "crypto": return "crescimento";
    default: return "crescimento";
  }
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  institution: string;
  conglomerate?: string; // banking group (e.g., "Itaú Unibanco" for Itaú, Íon, etc.)
  titular?: string; // CPF holder profileId
  securityLevel?: SecurityLevel;
  bucket?: PatrimonialBucketId;
  currentBalance: number;
  monthlyContribution: number;
  annualRate: number;
  startDate: string;
  maturityDate?: string;
  profileId?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HoldingByInstitution {
  institution: string;
  conglomerate?: string;
  investments: Investment[];
  totalBalance: number;
}

// ===== Goals =====

export type GoalStatus = "active" | "paused" | "completed" | "cancelled";

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category: "emergency" | "retirement" | "house" | "travel" | "education" | "freedom" | "family" | "other";
  status: GoalStatus;
  priority: number;
  profileId?: string; // null = shared goal
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  goalId?: string;
  label: string;
  value: number;
  reachedAt?: string;
  estimatedDate?: string;
}

// ===== Snapshots & Summaries =====

export interface FinancialSnapshot {
  id: string;
  monthKey: string;
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
  totalDebts: number;
  netWorth: number;
  savingsRate: number;
  emergencyFundMonths: number;
  createdAt: string;
}

export interface MonthlySummary {
  monthKey: string;
  incomeTotal: number;
  expenseTotal: number;
  expensesByCategory: Partial<Record<ExpenseCategory, number>>;
  fixedExpenses: number;
  variableExpenses: number;
  investmentTotal: number;
  debtPayments: number;
  balance: number; // income - expenses
  savingsRate: number;
  notes?: string;
}

// ===== Behavioral Signals =====

export interface BehavioralSignal {
  id: string;
  monthKey: string;
  type: "streak" | "overspend" | "underspend" | "goal-risk" | "improvement" | "debt-warning" | "milestone";
  message: string;
  severity: "info" | "warning" | "success" | "danger";
  createdAt: string;
  dismissed?: boolean;
}

// ===== Simulation =====

export interface SimulationScenario {
  id: string;
  name: string;
  description?: string;
  modifier: Record<string, number | string>;
  result?: {
    monthsToTarget: number | null;
    finalWealth: number;
    difference: number;
  };
  createdAt: string;
}

// ===== Education =====

export interface EducationalProgress {
  completedLessons: string[];
  currentModule?: string;
  totalPoints: number;
  achievements: string[];
  lastActivityAt?: string;
}

// ===== Root App Data =====

export interface AppData {
  // Schema
  schemaVersion: string;

  // Mode
  mode: PlanMode;

  // Profiles
  primaryProfile: Profile;
  partner?: Partner;

  // Financial Data
  incomes: Income[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  debts: Debt[];
  installments: Installment[];
  investments: Investment[];
  goals: Goal[];
  milestones: Milestone[];

  // Snapshots
  financialSnapshots: FinancialSnapshot[];
  monthlySummaries: MonthlySummary[];

  // Behavioral
  behavioralSignals: BehavioralSignal[];

  // Simulation
  simulationScenarios: SimulationScenario[];

  // Education
  educationalProgress: EducationalProgress;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ===== Defaults =====

export function generateId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultAppData(): AppData {
  return {
    schemaVersion: "7.0.0",
    mode: "solo",
    primaryProfile: { id: generateId(), name: "", age: 25, avatarColor: "hsl(var(--primary))" },
    partner: undefined,
    incomes: [],
    expenses: [],
    recurringExpenses: [],
    debts: [],
    installments: [],
    investments: [],
    goals: [],
    milestones: [],
    financialSnapshots: [],
    monthlySummaries: [],
    behavioralSignals: [],
    simulationScenarios: [],
    educationalProgress: { completedLessons: [], totalPoints: 0, achievements: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultExpense(monthKey: string, profileId?: string): Partial<Expense> {
  return {
    id: generateId(),
    name: "",
    amount: 0,
    category: "outros",
    type: "variable",
    recurrence: "one-time",
    status: "pending",
    ownership: profileId ? "individual" : "shared",
    responsibleProfileId: profileId,
    priority: "important",
    monthKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultDebt(): Partial<Debt> {
  return {
    id: generateId(),
    name: "",
    type: "installment",
    totalAmount: 0,
    currentInstallment: 1,
    totalInstallments: 1,
    monthlyPayment: 0,
    interestRate: 0,
    dueDay: 1,
    risk: "low",
    payoffPriority: 1,
    active: true,
    startDate: new Date().toISOString().slice(0, 7),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
