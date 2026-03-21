/**
 * useAppData — Central hook for the V7 entity model.
 * Manages all financial entities: profiles, incomes, expenses, debts, etc.
 * Works alongside usePlanData for backward compatibility with investment tracking.
 */

import { useState, useCallback, useEffect } from "react";
import {
  AppData, PlanMode, Profile, Partner, Income, Expense, RecurringExpense,
  Debt, Installment, Investment, Goal, Milestone,
  MonthlySummary, BehavioralSignal, generateId, ExpenseCategory,
} from "@/lib/models";
import { loadAppData, saveAppData, saveAppBackup } from "@/lib/appStorage";

export function useAppData() {
  const [appData, setAppData] = useState<AppData>(loadAppData);

  useEffect(() => {
    saveAppData(appData);
  }, [appData]);

  // ===== Mode =====

  const setMode = useCallback((mode: PlanMode) => {
    setAppData((prev) => {
      const updated = { ...prev, mode };
      // When switching to solo, soft-delete partner but preserve data
      if (mode === "solo" && prev.partner) {
        updated.partner = { ...prev.partner, removedAt: new Date().toISOString() };
      }
      // When switching back to couple, restore partner
      if (mode === "couple" && prev.partner?.removedAt) {
        updated.partner = { ...prev.partner, removedAt: undefined };
      }
      return updated;
    });
  }, []);

  // ===== Profiles =====

  const updatePrimaryProfile = useCallback((profile: Partial<Profile>) => {
    setAppData((prev) => ({
      ...prev,
      primaryProfile: { ...prev.primaryProfile, ...profile },
    }));
  }, []);

  const addPartner = useCallback((name: string, age?: number) => {
    setAppData((prev) => ({
      ...prev,
      mode: "couple" as PlanMode,
      partner: {
        profile: { id: generateId(), name, age, avatarColor: "hsl(var(--accent))" },
        addedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const removePartner = useCallback(() => {
    setAppData((prev) => ({
      ...prev,
      mode: "solo" as PlanMode,
      partner: prev.partner ? { ...prev.partner, removedAt: new Date().toISOString() } : undefined,
    }));
  }, []);

  const updatePartnerProfile = useCallback((profile: Partial<Profile>) => {
    setAppData((prev) => {
      if (!prev.partner) return prev;
      return {
        ...prev,
        partner: {
          ...prev.partner,
          profile: { ...prev.partner.profile, ...profile },
        },
      };
    });
  }, []);

  // ===== Generic CRUD helpers =====

  function crudAdd<T extends { id: string }>(key: keyof AppData) {
    return (item: T) => {
      setAppData((prev) => ({
        ...prev,
        [key]: [...(prev[key] as T[]), item],
      }));
    };
  }

  function crudUpdate<T extends { id: string }>(key: keyof AppData) {
    return (id: string, updates: Partial<T>) => {
      setAppData((prev) => ({
        ...prev,
        [key]: (prev[key] as T[]).map((item) =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        ),
      }));
    };
  }

  function crudDelete<T extends { id: string }>(key: keyof AppData) {
    return (id: string) => {
      setAppData((prev) => ({
        ...prev,
        [key]: (prev[key] as T[]).filter((item) => item.id !== id),
      }));
    };
  }

  // ===== Incomes =====
  const addIncome = crudAdd<Income>("incomes");
  const updateIncome = crudUpdate<Income>("incomes");
  const deleteIncome = (id: string) => crudDelete<Income>("incomes")(id);

  // ===== Expenses =====
  const addExpense = crudAdd<Expense>("expenses");
  const updateExpense = crudUpdate<Expense>("expenses");
  const deleteExpense = (id: string) => crudDelete<Expense>("expenses")(id);

  const duplicateExpense = useCallback((id: string) => {
    setAppData((prev) => {
      const source = prev.expenses.find((e) => e.id === id);
      if (!source) return prev;
      const duplicate: Expense = {
        ...source,
        id: generateId(),
        name: `${source.name} (cópia)`,
        status: "pending",
        paidDate: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { ...prev, expenses: [...prev.expenses, duplicate] };
    });
  }, []);

  const markExpensePaid = useCallback((id: string) => {
    setAppData((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) =>
        e.id === id ? { ...e, status: "paid" as const, paidDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() } : e
      ),
    }));
  }, []);

  const convertToRecurring = useCallback((expenseId: string) => {
    setAppData((prev) => {
      const expense = prev.expenses.find((e) => e.id === expenseId);
      if (!expense) return prev;
      const recurring: RecurringExpense = {
        id: generateId(),
        name: expense.name,
        amount: expense.amount,
        category: expense.category,
        subcategory: expense.subcategory,
        type: expense.type,
        ownership: expense.ownership,
        responsibleProfileId: expense.responsibleProfileId,
        priority: expense.priority,
        active: true,
        startDate: expense.monthKey,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, recurringExpenses: [...prev.recurringExpenses, recurring] };
    });
  }, []);

  // ===== Recurring Expenses =====
  const addRecurringExpense = crudAdd<RecurringExpense>("recurringExpenses");
  const updateRecurringExpense = crudUpdate<RecurringExpense>("recurringExpenses");
  const deleteRecurringExpense = (id: string) => crudDelete<RecurringExpense>("recurringExpenses")(id);

  // ===== Debts =====
  const addDebt = crudAdd<Debt>("debts");
  const updateDebt = crudUpdate<Debt>("debts");
  const deleteDebt = (id: string) => crudDelete<Debt>("debts")(id);

  // ===== Installments =====
  const addInstallment = crudAdd<Installment>("installments");
  const updateInstallment = crudUpdate<Installment>("installments");
  const deleteInstallment = (id: string) => crudDelete<Installment>("installments")(id);

  // ===== Investments =====
  const addInvestment = crudAdd<Investment>("investments");
  const updateInvestment = crudUpdate<Investment>("investments");
  const deleteInvestment = (id: string) => crudDelete<Investment>("investments")(id);

  // ===== Goals =====
  const addGoal = crudAdd<Goal>("goals");
  const updateGoal = crudUpdate<Goal>("goals");
  const deleteGoal = (id: string) => crudDelete<Goal>("goals")(id);

  // ===== Milestones =====
  const addMilestone = crudAdd<Milestone>("milestones");

  // ===== Debts =====
  const addBehavioralSignal = crudAdd<BehavioralSignal>("behavioralSignals");
  const dismissSignal = useCallback((id: string) => {
    setAppData((prev) => ({
      ...prev,
      behavioralSignals: prev.behavioralSignals.map((s) =>
        s.id === id ? { ...s, dismissed: true } : s
      ),
    }));
  }, []);

  // ===== Summaries =====

  const getExpensesForMonth = useCallback((monthKey: string) => {
    return appData.expenses.filter((e) => e.monthKey === monthKey);
  }, [appData.expenses]);

  const getExpensesByCategory = useCallback((monthKey: string): Partial<Record<ExpenseCategory, number>> => {
    const monthExpenses = appData.expenses.filter((e) => e.monthKey === monthKey);
    const result: Partial<Record<ExpenseCategory, number>> = {};
    monthExpenses.forEach((e) => {
      result[e.category] = (result[e.category] || 0) + e.amount;
    });
    return result;
  }, [appData.expenses]);

  const getMonthlySummary = useCallback((monthKey: string): MonthlySummary => {
    const monthExpenses = appData.expenses.filter((e) => e.monthKey === monthKey);
    const monthIncomes = appData.incomes.filter((i) => i.active);

    const incomeTotal = monthIncomes.reduce((s, i) => s + i.amount, 0);
    const expenseTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const fixedExpenses = monthExpenses.filter((e) => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
    const variableExpenses = monthExpenses.filter((e) => e.type === "variable").reduce((s, e) => s + e.amount, 0);
    const debtPayments = appData.debts.filter((d) => d.active).reduce((s, d) => s + d.monthlyPayment, 0);
    const investmentTotal = appData.investments.filter((i) => i.active).reduce((s, i) => s + i.monthlyContribution, 0);

    const expensesByCategory: Partial<Record<ExpenseCategory, number>> = {};
    monthExpenses.forEach((e) => {
      expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
    });

    return {
      monthKey,
      incomeTotal,
      expenseTotal,
      expensesByCategory,
      fixedExpenses,
      variableExpenses,
      investmentTotal,
      debtPayments,
      balance: incomeTotal - expenseTotal - debtPayments,
      savingsRate: incomeTotal > 0 ? (incomeTotal - expenseTotal - debtPayments) / incomeTotal : 0,
    };
  }, [appData.expenses, appData.incomes, appData.debts, appData.investments]);

  // ===== Backup =====
  const createBackup = useCallback(() => {
    saveAppBackup(appData);
  }, [appData]);

  // ===== Active profiles helper =====
  const getActiveProfiles = useCallback((): Profile[] => {
    const profiles = [appData.primaryProfile];
    if (appData.mode === "couple" && appData.partner && !appData.partner.removedAt) {
      profiles.push(appData.partner.profile);
    }
    return profiles;
  }, [appData.primaryProfile, appData.partner, appData.mode]);

  // ===== Total debts =====
  const getTotalActiveDebts = useCallback((): number => {
    return appData.debts
      .filter((d) => d.active)
      .reduce((s, d) => s + (d.totalAmount - (d.currentInstallment - 1) * d.monthlyPayment), 0);
  }, [appData.debts]);

  return {
    appData,
    setAppData,

    // Mode
    setMode,

    // Profiles
    updatePrimaryProfile,
    addPartner,
    removePartner,
    updatePartnerProfile,
    getActiveProfiles,

    // Incomes
    addIncome,
    updateIncome,
    deleteIncome,

    // Expenses
    addExpense,
    updateExpense,
    deleteExpense,
    duplicateExpense,
    markExpensePaid,
    convertToRecurring,

    // Recurring Expenses
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,

    // Debts
    addDebt,
    updateDebt,
    deleteDebt,

    // Installments
    addInstallment,
    updateInstallment,
    deleteInstallment,

    // Investments
    addInvestment,
    updateInvestment,
    deleteInvestment,

    // Goals
    addGoal,
    updateGoal,
    deleteGoal,

    // Milestones
    addMilestone,

    // Behavioral
    addBehavioralSignal,
    dismissSignal,

    // Summaries
    getExpensesForMonth,
    getExpensesByCategory,
    getMonthlySummary,
    getTotalActiveDebts,

    // Backup
    createBackup,
  };
}
