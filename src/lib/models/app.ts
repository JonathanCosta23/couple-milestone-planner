/**
 * Modelo raiz da aplicação (AppData) e factories de defaults.
 */

import type { PlanMode, Profile, Partner } from "./identity";
import type { Income, Expense, RecurringExpense } from "./cashflow";
import type { Debt, Installment } from "./debts";
import type { Investment } from "./wealth";
import type { Goal, Milestone } from "./goals";
import type {
  FinancialSnapshot,
  MonthlySummary,
  BehavioralSignal,
  SimulationScenario,
  EducationalProgress,
} from "./tracking";

export function generateId(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

export function createDefaultAppData(): AppData {
  return {
    schemaVersion: "7.0.0",
    mode: "individual",
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
