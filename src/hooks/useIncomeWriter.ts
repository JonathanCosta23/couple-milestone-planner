/**
 * useIncomeWriter — Persistência real de fontes de renda na tabela `income`.
 * Espelha useAssetWriter. RLS garante isolamento por user_id.
 * Trigger validate_flow_member_link() resolve member_id no modo individual.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Income } from "@/lib/models";
import { trackWriterChange } from "@/lib/services/auditService";

export interface IncomeRow {
  id: string;
  plan_id: string;
  user_id: string;
  member_id: string | null;
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

interface WriterResult<T> {
  data: T | null;
  error: string | null;
}

const RECURRENCE_TO_TYPE: Record<Income["recurrence"], string> = {
  monthly: "salary",
  biweekly: "salary",
  weekly: "salary",
  yearly: "bonus",
  "one-time": "other",
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
  const recurrence: Income["recurrence"] =
    row.income_type === "bonus" ? "yearly" :
    row.is_recurring === false ? "one-time" : "monthly";
  return {
    id: row.id,
    profileId: row.member_id ?? "",
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
  ctx: { userId: string; planId: string; memberId?: string | null },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: ctx.userId,
    plan_id: ctx.planId,
  };
  // member_id: só entra no payload quando explicitado (`null` = limpar,
  // valor = setar). `undefined` significa "não tocar".
  if (ctx.memberId !== undefined) payload.member_id = ctx.memberId;
  if (inc.label !== undefined) payload.source = inc.label || "Renda";
  if (inc.type !== undefined) payload.income_type = inc.type;
  else if (inc.recurrence !== undefined) payload.income_type = RECURRENCE_TO_TYPE[inc.recurrence];
  if (inc.amount !== undefined) payload.amount = inc.amount;
  if (inc.recurrence !== undefined) payload.is_recurring = inc.recurrence !== "one-time";
  if (inc.startDate !== undefined) payload.income_date = normalizeDate(inc.startDate);
  if (inc.notes !== undefined) payload.notes = inc.notes || null;
  return payload;
}

export function useIncomeWriter() {
  const { user } = useAuth();

  const listIncome = useCallback(
    async (planId: string): Promise<WriterResult<IncomeRow[]>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const { data, error } = await supabase
        .from("income").select("*")
        .eq("plan_id", planId).eq("user_id", uid)
        .order("created_at", { ascending: true });
      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as IncomeRow[], error: null };
    },
    [user],
  );

  const createIncome = useCallback(
    async (planId: string, income: Income, memberId?: string | null): Promise<WriterResult<IncomeRow>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const payload = incomeToPayload(income, { userId: uid, planId, memberId });
      if (!payload.source) payload.source = "Renda";
      if (!payload.income_type) payload.income_type = "salary";
      const { data, error } = await supabase
        .from("income").insert(payload as never).select().single();
      if (error || !data) return { data: null, error: error?.message ?? "Falha ao criar renda." };
      void trackWriterChange({
        userId: uid, planId, entity: "income",
        entityId: (data as IncomeRow).id, action: "create",
        newValue: data as unknown as Record<string, unknown>,
        event: "income_created",
      });
      return { data: data as IncomeRow, error: null };
    },
    [user],
  );

  const updateIncome = useCallback(
    async (planId: string, incomeId: string, patch: Partial<Income>, memberId?: string | null): Promise<WriterResult<IncomeRow>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const payload = incomeToPayload(patch, { userId: uid, planId, memberId });
      delete payload.user_id;
      delete payload.plan_id;
      const { data, error } = await supabase
        .from("income").update(payload as never)
        .eq("id", incomeId).eq("user_id", uid).select().single();
      if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar renda." };
      void trackWriterChange({
        userId: uid, planId, entity: "income",
        entityId: incomeId, action: "update",
        newValue: data as unknown as Record<string, unknown>,
        event: "income_updated",
      });
      return { data: data as IncomeRow, error: null };
    },
    [user],
  );

  const deleteIncome = useCallback(
    async (incomeId: string): Promise<WriterResult<true>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const { error } = await supabase.from("income").delete().eq("id", incomeId).eq("user_id", uid);
      if (error) return { data: null, error: error.message };
      void trackWriterChange({
        userId: uid, entity: "income", entityId: incomeId,
        action: "delete", event: "income_deleted",
      });
      return { data: true, error: null };
    },
    [user],
  );

  return { listIncome, createIncome, updateIncome, deleteIncome };
}
