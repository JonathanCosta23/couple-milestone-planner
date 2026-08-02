/**
 * useIncomeWriter — Persistência de renda com ownership explícito.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Income, OwnershipScope } from "@/lib/models";
import { applyOwnershipPatch } from "@/lib/models";
import { trackWriterChange } from "@/lib/services/auditService";

export interface IncomeRow {
  id: string;
  plan_id: string;
  user_id: string;
  member_id: string | null;
  ownership_scope: OwnershipScope;
  source: string;
  income_type: string;
  amount: number;
  is_recurring: boolean;
  income_date: string | null;
  month_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WriterResult<T> { data: T | null; error: string | null }

const RECURRENCE_TO_TYPE: Record<Income["recurrence"], string> = {
  monthly: "salary", biweekly: "salary", weekly: "salary",
  yearly: "bonus", "one-time": "other",
};

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function incomeRowToModel(row: IncomeRow): Income {
  const recurrence: Income["recurrence"] = row.income_type === "bonus"
    ? "yearly" : row.is_recurring === false ? "one-time" : "monthly";
  return {
    id: row.id,
    profileId: row.member_id ?? "",
    ownershipScope: row.ownership_scope,
    label: row.source ?? "",
    amount: Number(row.amount ?? 0),
    type: (row.income_type as Income["type"]) ?? "other",
    recurrence,
    active: true,
    startDate: row.income_date ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export function incomeToPayload(
  inc: Partial<Income>,
  ctx: { userId: string; planId: string; memberId?: string | null; ownershipScope?: OwnershipScope },
): Record<string, unknown> {
  const payload: Record<string, unknown> = { plan_id: ctx.planId };
  applyOwnershipPatch(payload, {
    memberId: ctx.memberId,
    ownershipScope: ctx.ownershipScope ?? inc.ownershipScope,
  });
  if (inc.label !== undefined) payload.source = inc.label || "Renda";
  if (inc.type !== undefined) payload.income_type = inc.type;
  else if (inc.recurrence !== undefined) payload.income_type = RECURRENCE_TO_TYPE[inc.recurrence];
  if (inc.amount !== undefined) payload.amount = inc.amount;
  if (inc.recurrence !== undefined) payload.is_recurring = inc.recurrence !== "one-time";
  if (inc.startDate !== undefined) payload.income_date = normalizeDate(inc.startDate);
  if (inc.notes !== undefined) payload.notes = inc.notes || null;
  return payload;
}

function ownershipAudit(row: IncomeRow): Record<string, unknown> {
  return { ownership_scope: row.ownership_scope, member_id_present: Boolean(row.member_id), origin: "writer" };
}

export function useIncomeWriter() {
  const { user } = useAuth();

  const listIncome = useCallback(async (planId: string): Promise<WriterResult<IncomeRow[]>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    const { data, error } = await supabase.from("income").select("*")
      .eq("plan_id", planId).eq("user_id", uid).order("created_at", { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as IncomeRow[], error: null };
  }, [user]);

  const createIncome = useCallback(async (
    planId: string, income: Income, memberId?: string | null,
  ): Promise<WriterResult<IncomeRow>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    if (!memberId) return { data: null, error: "member_required" };
    let payload: Record<string, unknown>;
    try {
      payload = incomeToPayload(income, {
        userId: uid, planId, memberId, ownershipScope: "individual",
      });
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "ownership_required" };
    }
    if (!payload.source) payload.source = "Renda";
    if (!payload.income_type) payload.income_type = "salary";
    const { data, error } = await supabase.from("income").insert(payload as never).select().single();
    if (error || !data) return { data: null, error: error?.message ?? "Falha ao criar renda." };
    const row = data as IncomeRow;
    void trackWriterChange({
      userId: uid, planId, entity: "income", entityId: row.id, action: "create",
      newValue: ownershipAudit(row), event: "income_created",
      eventProperties: { ownership_scope: row.ownership_scope },
    });
    return { data: row, error: null };
  }, [user]);

  const updateIncome = useCallback(async (
    planId: string, incomeId: string, patch: Partial<Income>, memberId?: string | null,
  ): Promise<WriterResult<IncomeRow>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    let payload: Record<string, unknown>;
    try {
      payload = incomeToPayload(patch, {
        userId: uid, planId, memberId,
        ownershipScope: memberId === undefined ? patch.ownershipScope : memberId ? "individual" : patch.ownershipScope,
      });
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "ownership_required" };
    }
    delete payload.plan_id;
    const { data, error } = await supabase.from("income").update(payload as never)
      .eq("id", incomeId).eq("user_id", uid).select().single();
    if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar renda." };
    const row = data as IncomeRow;
    void trackWriterChange({
      userId: uid, planId, entity: "income", entityId: incomeId, action: "update",
      newValue: ownershipAudit(row), event: "income_updated",
    });
    return { data: row, error: null };
  }, [user]);

  const deleteIncome = useCallback(async (incomeId: string): Promise<WriterResult<true>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    const { error } = await supabase.from("income").delete().eq("id", incomeId).eq("user_id", uid);
    if (error) return { data: null, error: error.message };
    void trackWriterChange({ userId: uid, entity: "income", entityId: incomeId,
      action: "delete", event: "income_deleted" });
    return { data: true, error: null };
  }, [user]);

  return { listIncome, createIncome, updateIncome, deleteIncome };
}
