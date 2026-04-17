/**
 * Fluxo de caixa: rendas, gastos e gastos recorrentes (templates).
 */

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
  isRecurringSource?: boolean;
  recurringSourceId?: string;
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
