/**
 * useExpenseWriter — Persistência de gastos com ownership explícito.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Expense, OwnershipScope } from "@/lib/models";
import { applyOwnershipPatch } from "@/lib/models";
import { trackWriterChange } from "@/lib/services/auditService";

export interface ExpenseRow {
  id: string;
  plan_id: string;
  user_id: string;
  member_id: string | null;
  ownership_scope: OwnershipScope;
  category: string;
  subcategory: string | null;
  amount: number;
  is_essential: boolean;
  expense_type: string;
  is_recurring: boolean;
  expense_date: string | null;
  month_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WriterResult<T> { data: T | null; error: string | null }

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function expenseRowToModel(row: ExpenseRow): Expense {
  return {
    id: row.id,
    name: row.subcategory || row.category,
    amount: Number(row.amount ?? 0),
    category: (row.category as Expense["category"]) ?? "outros",
    subcategory: row.subcategory ?? undefined,
    type: (row.expense_type as Expense["type"]) ?? "fixed",
    recurrence: row.is_recurring ? "monthly" : "one-time",
    status: "paid",
    ownership: row.ownership_scope,
    ownershipScope: row.ownership_scope,
    responsibleProfileId: row.member_id ?? undefined,
    dueDate: row.expense_date ?? undefined,
    notes: row.notes ?? undefined,
    priority: row.is_essential ? "essential" : "optional",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    monthKey: row.month_key ?? row.created_at?.slice(0, 7) ?? "",
  };
}

export function expenseToPayload(
  exp: Partial<Expense>,
  ctx: { userId: string; planId: string; memberId?: string | null; ownershipScope?: OwnershipScope },
): Record<string, unknown> {
  const payload: Record<string, unknown> = { plan_id: ctx.planId };
  applyOwnershipPatch(payload, {
    memberId: ctx.memberId,
    ownershipScope: ctx.ownershipScope ?? exp.ownershipScope,
  });
  if (exp.category !== undefined) payload.category = exp.category;
  if (exp.subcategory !== undefined || exp.name !== undefined) payload.subcategory = exp.subcategory ?? exp.name ?? null;
  if (exp.amount !== undefined) payload.amount = exp.amount;
  if (exp.type !== undefined) payload.expense_type = exp.type;
  if (exp.priority !== undefined) payload.is_essential = exp.priority === "essential";
  if (exp.recurrence !== undefined) payload.is_recurring = exp.recurrence !== "one-time";
  if (exp.dueDate !== undefined) payload.expense_date = normalizeDate(exp.dueDate);
  if (exp.monthKey !== undefined) payload.month_key = exp.monthKey || null;
  if (exp.notes !== undefined) payload.notes = exp.notes || null;
  return payload;
}

function ownershipAudit(row: ExpenseRow): Record<string, unknown> {
  return { ownership_scope: row.ownership_scope, member_id_present: Boolean(row.member_id), origin: "writer" };
}

export function useExpenseWriter() {
  const { user } = useAuth();

  const listExpenses = useCallback(async (planId: string): Promise<WriterResult<ExpenseRow[]>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    const { data, error } = await supabase.from("expenses").select("*")
      .eq("plan_id", planId).eq("user_id", uid).order("created_at", { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as ExpenseRow[], error: null };
  }, [user]);

  const createExpense = useCallback(async (
    planId: string, expense: Expense, memberId?: string | null,
  ): Promise<WriterResult<ExpenseRow>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    if (!memberId) return { data: null, error: "member_required" };
    let payload: Record<string, unknown>;
    try {
      payload = expenseToPayload(expense, {
        userId: uid, planId, memberId, ownershipScope: "individual",
      });
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "ownership_required" };
    }
    if (!payload.category) payload.category = "outros";
    const { data, error } = await supabase.from("expenses").insert(payload as never).select().single();
    if (error || !data) return { data: null, error: error?.message ?? "Falha ao criar gasto." };
    const row = data as ExpenseRow;
    void trackWriterChange({
      userId: uid, planId, entity: "expense", entityId: row.id, action: "create",
      newValue: ownershipAudit(row), event: "expense_created",
      eventProperties: { ownership_scope: row.ownership_scope },
    });
    return { data: row, error: null };
  }, [user]);

  const updateExpense = useCallback(async (
    planId: string, expenseId: string, patch: Partial<Expense>, memberId?: string | null,
  ): Promise<WriterResult<ExpenseRow>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    let payload: Record<string, unknown>;
    try {
      payload = expenseToPayload(patch, {
        userId: uid, planId, memberId,
        ownershipScope: memberId === undefined ? patch.ownershipScope : memberId ? "individual" : patch.ownershipScope,
      });
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "ownership_required" };
    }
    delete payload.plan_id;
    const { data, error } = await supabase.from("expenses").update(payload as never)
      .eq("id", expenseId).eq("user_id", uid).select().single();
    if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar gasto." };
    const row = data as ExpenseRow;
    void trackWriterChange({
      userId: uid, planId, entity: "expense", entityId: expenseId, action: "update",
      newValue: ownershipAudit(row), event: "expense_updated",
    });
    return { data: row, error: null };
  }, [user]);

  const deleteExpense = useCallback(async (expenseId: string): Promise<WriterResult<true>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("user_id", uid);
    if (error) return { data: null, error: error.message };
    void trackWriterChange({ userId: uid, entity: "expense", entityId: expenseId,
      action: "delete", event: "expense_deleted" });
    return { data: true, error: null };
  }, [user]);

  return { listExpenses, createExpense, updateExpense, deleteExpense };
}
