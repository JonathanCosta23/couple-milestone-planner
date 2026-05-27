/**
 * useMonthlyTrackingWriter — Persistência real de acompanhamento mensal.
 *
 * Tabelas:
 * - monthly_tracking: 1 registro por (plan_id, month_key) — totais do mês.
 * - monthly_member_tracking: 1 registro por (monthly_tracking_id, plan_member_id)
 *   com planejado/realizado por participante (Selic + CDB).
 *
 * O upsert garante idempotência: editar o mesmo mês várias vezes não duplica linhas.
 * RLS garante isolamento por user_id. A trigger validate_flow_member_link()
 * resolve member_id no modo individual.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MonthlyTrackingRow {
  id: string;
  plan_id: string;
  user_id: string;
  year: number;
  month: number;
  month_key: string;
  status: string;
  is_current: boolean;
  planned_total: number;
  actual_total: number;
  shortfall: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyMemberTrackingRow {
  id: string;
  monthly_tracking_id: string;
  plan_member_id: string;
  user_id: string;
  planned_selic: number;
  planned_cdb: number;
  actual_selic: number;
  actual_cdb: number;
  created_at: string;
  updated_at: string;
}

export interface MemberDepositInput {
  planMemberId: string;
  plannedSelic: number;
  plannedCDB: number;
  actualSelic: number;
  actualCDB: number;
}

interface WriterResult<T> {
  data: T | null;
  error: string | null;
}

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split("-").map(Number);
  return { year: y, month: m };
}

function deriveStatus(plannedTotal: number, actualTotal: number): string {
  if (actualTotal <= 0) return "pending";
  if (actualTotal >= plannedTotal && plannedTotal > 0) return "completed";
  return "partial";
}

export function useMonthlyTrackingWriter() {
  const { user } = useAuth();

  /** Lista todos os meses persistidos do plano. */
  const listMonthlyTracking = useCallback(
    async (planId: string): Promise<WriterResult<MonthlyTrackingRow[]>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const { data, error } = await supabase
        .from("monthly_tracking").select("*")
        .eq("plan_id", planId).eq("user_id", uid)
        .order("month_key", { ascending: true });
      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as MonthlyTrackingRow[], error: null };
    },
    [user],
  );

  /** Lista os depósitos por membro de um conjunto de meses (1 query). */
  const listMemberTracking = useCallback(
    async (monthlyTrackingIds: string[]): Promise<WriterResult<MonthlyMemberTrackingRow[]>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      if (monthlyTrackingIds.length === 0) return { data: [], error: null };
      const { data, error } = await supabase
        .from("monthly_member_tracking").select("*")
        .in("monthly_tracking_id", monthlyTrackingIds)
        .eq("user_id", uid);
      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as MonthlyMemberTrackingRow[], error: null };
    },
    [user],
  );

  /**
   * Upsert de um mês completo: cria/atualiza monthly_tracking e os depósitos
   * por membro. Idempotente. A unicidade de (plan_id, month_key) já é garantida
   * por constraint na migration da Fase 2.1.
   */
  const upsertMonth = useCallback(
    async (
      planId: string,
      monthKey: string,
      members: MemberDepositInput[],
      notes?: string,
      completed?: boolean,
    ): Promise<WriterResult<MonthlyTrackingRow>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      // Caminho preferencial: RPC transacional (mês + depósitos por membro).
      const rpcMembers = members
        .filter((m) => m.planMemberId)
        .map((m) => ({
          plan_member_id: m.planMemberId,
          planned_selic: m.plannedSelic,
          planned_cdb: m.plannedCDB,
          actual_selic: m.actualSelic,
          actual_cdb: m.actualCDB,
        }));

      const rpcRes = await supabase.rpc("upsert_month_with_members", {
        p_plan_id: planId,
        p_month_key: monthKey,
        p_members: rpcMembers as unknown as never,
        p_notes: notes ?? null,
        p_completed: completed ?? null,
      });

      if (!rpcRes.error && rpcRes.data) {
        const payload = rpcRes.data as unknown as { tracking: MonthlyTrackingRow };
        void trackWriterChange({
          userId: uid,
          planId,
          entity: "monthly_tracking",
          entityId: payload.tracking?.id ?? null,
          action: payload.tracking?.status === "completed" ? "complete" : "update",
          newValue: payload.tracking as unknown as Record<string, unknown>,
          event: "monthly_deposit_registered",
          eventProperties: {
            month_key: monthKey,
            status: payload.tracking?.status,
            actual_total: payload.tracking?.actual_total,
            planned_total: payload.tracking?.planned_total,
          },
        });
        if (payload.tracking?.status === "completed") {
          void trackWriterChange({
            userId: uid,
            planId,
            entity: "monthly_tracking",
            entityId: payload.tracking.id,
            action: "complete",
            event: "month_completed",
            eventProperties: { month_key: monthKey },
          });
        }
        return { data: payload.tracking, error: null };
      }
      if (rpcRes.error && !/function .* does not exist|PGRST202/i.test(rpcRes.error.message)) {
        return { data: null, error: rpcRes.error.message };
      }

      // Fallback legacy (delete+insert fora de transação) — só se RPC indisponível.
      const { year, month } = parseMonthKey(monthKey);
      const plannedTotal = members.reduce((s, m) => s + m.plannedSelic + m.plannedCDB, 0);
      const actualTotal = members.reduce((s, m) => s + m.actualSelic + m.actualCDB, 0);
      const status = completed ? "completed" : deriveStatus(plannedTotal, actualTotal);
      const shortfall = Math.max(0, plannedTotal - actualTotal);

      // 1. Verifica se já existe (busca por month_key + plan_id)
      const { data: existing } = await supabase
        .from("monthly_tracking").select("id")
        .eq("plan_id", planId).eq("user_id", uid).eq("month_key", monthKey)
        .maybeSingle();

      const trackingPayload: Record<string, unknown> = {
        user_id: uid,
        plan_id: planId,
        year, month, month_key: monthKey,
        planned_total: plannedTotal,
        actual_total: actualTotal,
        shortfall,
        status,
        notes: notes ?? null,
      };

      let trackingRow: MonthlyTrackingRow | null = null;
      if (existing?.id) {
        const { data, error } = await supabase
          .from("monthly_tracking").update(trackingPayload as never)
          .eq("id", existing.id).eq("user_id", uid).select().single();
        if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar mês." };
        trackingRow = data as MonthlyTrackingRow;
      } else {
        const { data, error } = await supabase
          .from("monthly_tracking").insert(trackingPayload as never).select().single();
        if (error || !data) return { data: null, error: error?.message ?? "Falha ao criar mês." };
        trackingRow = data as MonthlyTrackingRow;
      }

      // 2. Substitui os depósitos por membro (delete + insert simples mantém código limpo)
      if (members.length > 0) {
        await supabase
          .from("monthly_member_tracking").delete()
          .eq("monthly_tracking_id", trackingRow.id).eq("user_id", uid);

        const memberRows = members
          .filter((m) => m.planMemberId)
          .map((m) => ({
            user_id: uid,
            monthly_tracking_id: trackingRow!.id,
            plan_member_id: m.planMemberId,
            planned_selic: m.plannedSelic,
            planned_cdb: m.plannedCDB,
            actual_selic: m.actualSelic,
            actual_cdb: m.actualCDB,
          }));

        if (memberRows.length > 0) {
          const { error: memErr } = await supabase
            .from("monthly_member_tracking").insert(memberRows as never);
          if (memErr) return { data: null, error: `Mês salvo mas falha em participantes: ${memErr.message}` };
        }
      }

      return { data: trackingRow, error: null };
    },
    [user],
  );

  /** Atualiza apenas notas do mês (sem mexer em depósitos). */
  const updateMonthNotes = useCallback(
    async (planId: string, monthKey: string, notes: string): Promise<WriterResult<true>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const { error } = await supabase
        .from("monthly_tracking").update({ notes } as never)
        .eq("plan_id", planId).eq("user_id", uid).eq("month_key", monthKey);
      if (error) return { data: null, error: error.message };
      return { data: true, error: null };
    },
    [user],
  );

  /** Marca/desmarca o mês como concluído. */
  const toggleMonthCompleted = useCallback(
    async (planId: string, monthKey: string, completed: boolean): Promise<WriterResult<true>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      const status = completed ? "completed" : "pending";
      const { error } = await supabase
        .from("monthly_tracking").update({ status } as never)
        .eq("plan_id", planId).eq("user_id", uid).eq("month_key", monthKey);
      if (error) return { data: null, error: error.message };
      return { data: true, error: null };
    },
    [user],
  );

  return {
    listMonthlyTracking,
    listMemberTracking,
    upsertMonth,
    updateMonthNotes,
    toggleMonthCompleted,
  };
}
