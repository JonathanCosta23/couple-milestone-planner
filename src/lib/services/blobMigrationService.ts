/**
 * Blob Migration Service — Fase 2 (D2 = B)
 *
 * Migra income/expenses/debts que vieram no blob `user_financial_data.app_data`
 * (ou diretamente do AppData local) para as tabelas normalizadas:
 * - income
 * - expenses
 * - debts
 *
 * Princípios:
 * - Não-destrutivo: não apaga o blob; apenas espelha em tabelas.
 * - Idempotente: se a tabela já tem itens para o plano, NÃO duplica.
 * - Observa RLS: todo insert leva user_id e plan_id corretos.
 * - Resolve member_id pelo nome (titular vs parceiro), com fallback null em individual
 *   (a trigger validate_flow_member_link resolve para o titular).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AppData, Income, Expense, Debt } from "@/lib/models";
import type { PlanMemberRow } from "@/hooks/usePlan";

export interface BlobMigrationSummary {
  incomes: number;
  expenses: number;
  debts: number;
  errors: string[];
}

/**
 * Carrega o blob `app_data` da tabela legada `user_financial_data`.
 * Retorna null se não houver blob salvo.
 */
export async function loadAppDataFromBlob(userId: string): Promise<AppData | null> {
  const { data, error } = await supabase
    .from("user_financial_data")
    .select("app_data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.app_data) return null;
  return data.app_data as unknown as AppData;
}

interface PreviewCounts {
  incomes: number;
  expenses: number;
  debts: number;
  hasAnything: boolean;
}

/**
 * Conta o que existe no blob/local sem persistir nada. Usado pelo modal
 * para mostrar ao usuário "vamos migrar X gastos, Y rendas...".
 */
export function previewBlobMigration(appData: AppData | null): PreviewCounts {
  if (!appData) return { incomes: 0, expenses: 0, debts: 0, hasAnything: false };
  const incomes = appData.incomes?.length ?? 0;
  const expenses = appData.expenses?.length ?? 0;
  const debts = appData.debts?.length ?? 0;
  return { incomes, expenses, debts, hasAnything: incomes + expenses + debts > 0 };
}

/**
 * Resolve o plan_member_id correspondente a um item do blob.
 * Prioridade:
 * 1) Match exato pelo profileId armazenado no blob.
 * 2) Match pelo nome do profile primário/parceiro do AppData.
 * 3) Null — trigger validate_flow_member_link resolverá no modo individual.
 */
function buildMemberResolver(appData: AppData, members: PlanMemberRow[]) {
  const primary = members.find((m) => m.is_primary) ?? null;
  const partner = members.find((m) => !m.is_primary && m.is_active) ?? null;

  return (profileId?: string): string | null => {
    if (!profileId) return primary?.id ?? null;
    if (appData.primaryProfile?.id === profileId) return primary?.id ?? null;
    if (appData.partner?.profile?.id === profileId) return partner?.id ?? primary?.id ?? null;
    return primary?.id ?? null;
  };
}

function incomeToRow(inc: Income, ctx: { userId: string; planId: string; memberId: string | null }) {
  const recurrenceToType: Record<Income["recurrence"], string> = {
    monthly: "salary", biweekly: "salary", weekly: "salary",
    yearly: "bonus", "one-time": "other",
  };
  return {
    user_id: ctx.userId,
    plan_id: ctx.planId,
    member_id: ctx.memberId,
    source: inc.label || "Renda",
    income_type: inc.type || recurrenceToType[inc.recurrence] || "salary",
    amount: inc.amount || 0,
    is_recurring: inc.recurrence !== "one-time",
    income_date: inc.startDate ? `${inc.startDate}${inc.startDate.length === 7 ? "-01" : ""}` : null,
    notes: inc.notes ?? null,
  };
}

function expenseToRow(exp: Expense, ctx: { userId: string; planId: string; memberId: string | null }) {
  return {
    user_id: ctx.userId,
    plan_id: ctx.planId,
    member_id: ctx.memberId,
    category: exp.category || "outros",
    subcategory: exp.subcategory || exp.name || null,
    amount: exp.amount || 0,
    is_essential: exp.priority === "essential",
    expense_type: exp.type || "fixed",
    is_recurring: exp.recurrence !== "one-time",
    expense_date: exp.dueDate ? `${exp.dueDate}${exp.dueDate.length === 7 ? "-01" : ""}` : null,
    month_key: exp.monthKey || null,
    notes: exp.notes ?? null,
  };
}

function debtToRow(debt: Debt, ctx: { userId: string; planId: string; memberId: string | null }) {
  const PRIORITY_TO_DB: Record<number, string> = { 1: "high", 2: "medium", 3: "low" };
  return {
    user_id: ctx.userId,
    plan_id: ctx.planId,
    member_id: ctx.memberId,
    debt_type: debt.type || "loan",
    institution: debt.creditor || debt.name || null,
    total_balance: debt.totalAmount || 0,
    monthly_payment: debt.monthlyPayment || 0,
    interest_rate: (debt.interestRate || 0) / 12,
    effective_cost: (debt.interestRate || 0) / 12,
    priority: PRIORITY_TO_DB[debt.payoffPriority ?? 2] ?? "medium",
    start_date: debt.startDate ? `${debt.startDate}${debt.startDate.length === 7 ? "-01" : ""}` : null,
    end_date: debt.endDate ? `${debt.endDate}${debt.endDate.length === 7 ? "-01" : ""}` : null,
    is_active: debt.active !== false,
  };
}

/**
 * Executa a migração do blob/AppData para as tabelas normalizadas.
 * Idempotente: se o plano já tem income/expenses/debts, pula a categoria
 * correspondente (evita duplicar). O usuário pode rodar de novo sem medo.
 */
export async function migrateBlobToTables(
  userId: string,
  planId: string,
  appData: AppData,
  members: PlanMemberRow[],
): Promise<BlobMigrationSummary> {
  const summary: BlobMigrationSummary = { incomes: 0, expenses: 0, debts: 0, errors: [] };
  const resolveMember = buildMemberResolver(appData, members);

  // 1. Income
  const { count: existingIncomes } = await supabase
    .from("income").select("id", { count: "exact", head: true })
    .eq("plan_id", planId).eq("user_id", userId);
  if ((existingIncomes ?? 0) === 0 && (appData.incomes?.length ?? 0) > 0) {
    const rows = appData.incomes.map((inc) =>
      incomeToRow(inc, { userId, planId, memberId: resolveMember(inc.profileId) }),
    );
    const { error, data } = await supabase.from("income").insert(rows as never).select("id");
    if (error) summary.errors.push(`Renda: ${error.message}`);
    else summary.incomes = data?.length ?? 0;
  }

  // 2. Expenses
  const { count: existingExpenses } = await supabase
    .from("expenses").select("id", { count: "exact", head: true })
    .eq("plan_id", planId).eq("user_id", userId);
  if ((existingExpenses ?? 0) === 0 && (appData.expenses?.length ?? 0) > 0) {
    const rows = appData.expenses.map((exp) =>
      expenseToRow(exp, { userId, planId, memberId: resolveMember(exp.responsibleProfileId) }),
    );
    const { error, data } = await supabase.from("expenses").insert(rows as never).select("id");
    if (error) summary.errors.push(`Gastos: ${error.message}`);
    else summary.expenses = data?.length ?? 0;
  }

  // 3. Debts
  const { count: existingDebts } = await supabase
    .from("debts").select("id", { count: "exact", head: true })
    .eq("plan_id", planId).eq("user_id", userId);
  if ((existingDebts ?? 0) === 0 && (appData.debts?.length ?? 0) > 0) {
    const rows = appData.debts.map((debt) =>
      debtToRow(debt, { userId, planId, memberId: resolveMember(debt.profileId) }),
    );
    const { error, data } = await supabase.from("debts").insert(rows as never).select("id");
    if (error) summary.errors.push(`Dívidas: ${error.message}`);
    else summary.debts = data?.length ?? 0;
  }

  return summary;
}
