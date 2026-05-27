/**
 * useDebtWriter — Persistência real de dívidas na tabela `debts`.
 * Espelha useAssetWriter. Mapa Debt (modelo) ↔ debts (tabela).
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Debt } from "@/lib/models";

export interface DebtRow {
  id: string;
  plan_id: string;
  user_id: string;
  member_id: string | null;
  debt_type: string;
  institution: string | null;
  total_balance: number;
  monthly_payment: number;
  interest_rate: number;
  effective_cost: number;
  priority: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WriterResult<T> {
  data: T | null;
  error: string | null;
}

const PRIORITY_TO_DB: Record<number, string> = { 1: "high", 2: "medium", 3: "low" };
const PRIORITY_FROM_DB: Record<string, number> = { high: 1, medium: 2, low: 3 };

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function debtRowToModel(row: DebtRow): Debt {
  const monthlyPayment = Number(row.monthly_payment ?? 0);
  const total = Number(row.total_balance ?? 0);
  const totalInstallments = monthlyPayment > 0 ? Math.max(1, Math.ceil(total / monthlyPayment)) : 1;
  const risk: Debt["risk"] =
    row.interest_rate >= 0.10 ? "toxic" :
    row.interest_rate >= 0.05 ? "high" :
    row.interest_rate >= 0.02 ? "medium" : "low";
  return {
    id: row.id,
    name: row.institution || row.debt_type || "Dívida",
    type: (row.debt_type as Debt["type"]) ?? "loan",
    totalAmount: total,
    currentInstallment: 1,
    totalInstallments,
    monthlyPayment,
    interestRate: Number(row.interest_rate ?? 0) * 12,
    dueDay: 1,
    creditor: row.institution ?? undefined,
    risk,
    payoffPriority: PRIORITY_FROM_DB[row.priority ?? "medium"] ?? 2,
    startDate: row.start_date ?? row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    endDate: row.end_date ?? undefined,
    active: row.is_active,
    profileId: row.member_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function debtToPayload(
  debt: Partial<Debt>,
  ctx: { userId: string; planId: string; memberId?: string | null },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: ctx.userId,
    plan_id: ctx.planId,
  };
  if (ctx.memberId !== undefined) payload.member_id = ctx.memberId;
  if (debt.type !== undefined) payload.debt_type = debt.type;
  if (debt.creditor !== undefined || debt.name !== undefined) {
    payload.institution = debt.creditor ?? debt.name ?? null;
  }
  if (debt.totalAmount !== undefined) payload.total_balance = debt.totalAmount;
  if (debt.monthlyPayment !== undefined) payload.monthly_payment = debt.monthlyPayment;
  if (debt.interestRate !== undefined) {
    // Modelo armazena anual; tabela armazena mensal.
    payload.interest_rate = debt.interestRate / 12;
    payload.effective_cost = debt.interestRate / 12;
  }
  if (debt.payoffPriority !== undefined) payload.priority = PRIORITY_TO_DB[debt.payoffPriority] ?? "medium";
  if (debt.startDate !== undefined) payload.start_date = normalizeDate(debt.startDate);
  if (debt.endDate !== undefined) payload.end_date = normalizeDate(debt.endDate);
  if (debt.active !== undefined) payload.is_active = debt.active;
  return payload;
}

export function useDebtWriter() {
  const { user } = useAuth();

  const listDebts = useCallback(
    async (planId: string): Promise<WriterResult<DebtRow[]>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const { data, error } = await supabase
        .from("debts").select("*")
        .eq("plan_id", planId).eq("user_id", uid)
        .order("created_at", { ascending: true });
      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as DebtRow[], error: null };
    },
    [user],
  );

  const createDebt = useCallback(
    async (planId: string, debt: Debt, memberId?: string | null): Promise<WriterResult<DebtRow>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const payload = debtToPayload(debt, { userId: uid, planId, memberId });
      if (!payload.debt_type) payload.debt_type = debt.type ?? "loan";
      const { data, error } = await supabase
        .from("debts").insert(payload as never).select().single();
      if (error || !data) return { data: null, error: error?.message ?? "Falha ao criar dívida." };
      return { data: data as DebtRow, error: null };
    },
    [user],
  );

  const updateDebt = useCallback(
    async (planId: string, debtId: string, patch: Partial<Debt>, memberId?: string | null): Promise<WriterResult<DebtRow>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const payload = debtToPayload(patch, { userId: uid, planId, memberId });
      delete payload.user_id;
      delete payload.plan_id;
      const { data, error } = await supabase
        .from("debts").update(payload as never)
        .eq("id", debtId).eq("user_id", uid).select().single();
      if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar dívida." };
      return { data: data as DebtRow, error: null };
    },
    [user],
  );

  const deactivateDebt = useCallback(
    async (debtId: string): Promise<WriterResult<true>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const { error } = await supabase.from("debts").update({ is_active: false })
        .eq("id", debtId).eq("user_id", uid);
      if (error) return { data: null, error: error.message };
      return { data: true, error: null };
    },
    [user],
  );

  const deleteDebt = useCallback(
    async (debtId: string): Promise<WriterResult<true>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const { error } = await supabase.from("debts").delete().eq("id", debtId).eq("user_id", uid);
      if (error) return { data: null, error: error.message };
      return { data: true, error: null };
    },
    [user],
  );

  return { listDebts, createDebt, updateDebt, deactivateDebt, deleteDebt };
}
