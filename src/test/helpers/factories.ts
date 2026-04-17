/**
 * Factories mínimas para construir AppData/PlanConfig/Investment válidos em testes.
 * Tudo opcional via Partial<> para permitir overrides cirúrgicos por caso.
 */
import type { AppData } from "@/lib/models";
import { createDefaultAppData } from "@/lib/models";
import type { PlanConfig, MonthRecord } from "@/lib/types";
import type { Investment } from "@/lib/models/wealth";
import type { Income } from "@/lib/models/cashflow";
import type { Expense } from "@/lib/models/cashflow";
import type { Debt } from "@/lib/models/debts";

export function makeConfig(overrides: Partial<PlanConfig> = {}): PlanConfig {
  return {
    initialAmount: 0,
    targetAmount: 1_000_000,
    years: 21,
    selicRate: 0.1315,
    cdbRate: 1.0,
    contributors: [{ name: "Você", plannedSelic: 1_000, plannedCDB: 0, age: 30 }],
    ...overrides,
  };
}

export function makeAppData(overrides: Partial<AppData> = {}): AppData {
  const base = createDefaultAppData();
  return { ...base, ...overrides };
}

export function makeInvestment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: overrides.id ?? `inv-${Math.random().toString(36).slice(2, 8)}`,
    name: "CDB Banco X",
    type: "cdb",
    institution: "Banco X",
    conglomerate: "Conglomerado X",
    investedAmount: 10_000,
    currentBalance: 10_000,
    bucket: "protecao-bancaria",
    titular: undefined,
    profileId: undefined,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Investment;
}

export function makeIncome(overrides: Partial<Income> = {}): Income {
  return {
    id: overrides.id ?? `inc-${Math.random().toString(36).slice(2, 8)}`,
    source: "Salário",
    amount: 5_000,
    type: "salary",
    active: true,
    profileId: "primary",
    monthKey: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Income;
}

export function makeExpense(monthKey: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id: overrides.id ?? `exp-${Math.random().toString(36).slice(2, 8)}`,
    name: "Aluguel",
    amount: 1_500,
    category: "moradia",
    type: "fixed",
    recurrence: "monthly",
    status: "paid",
    ownership: "shared",
    priority: "essential",
    monthKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Expense;
}

export function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: overrides.id ?? `debt-${Math.random().toString(36).slice(2, 8)}`,
    name: "Cartão",
    type: "installment",
    totalAmount: 5_000,
    currentInstallment: 1,
    totalInstallments: 10,
    monthlyPayment: 500,
    interestRate: 0.05,
    dueDay: 10,
    risk: "low",
    payoffPriority: 1,
    active: true,
    startDate: "2025-01",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Debt;
}

export const NO_MONTH_RECORDS: MonthRecord[] = [];
