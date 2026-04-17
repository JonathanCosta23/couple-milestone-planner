/**
 * Acompanhamento mensal, sinais comportamentais, simulação e educação.
 */

import type { ExpenseCategory } from "./cashflow";

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
  type:
    | "streak"
    | "overspend"
    | "underspend"
    | "goal-risk"
    | "improvement"
    | "debt-warning"
    | "milestone";
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
