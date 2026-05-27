/**
 * useTrackingActions — handler de domínio para acompanhamento mensal.
 * Persiste mês inteiro de forma idempotente (planejado + realizado por membro).
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { MonthRecord, PlanConfig } from "@/lib/types";
import type { PlanMemberRow } from "@/hooks/usePlan";
import { useMonthlyTrackingWriter } from "@/hooks/useMonthlyTrackingWriter";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  members: PlanMemberRow[];
  config: PlanConfig;
  monthRecords: MonthRecord[];
  updateMonthRecordLocal: (
    monthKey: string,
    contributorIndex: number,
    deposit: { actualSelic: number; actualCDB: number },
    notes?: string,
  ) => void;
  updateMonthNotesLocal: (monthKey: string, notes: string) => void;
  toggleMonthCompletedLocal: (monthKey: string) => void;
}

export interface TrackingActions {
  updateMonth: (
    monthKey: string,
    contributorIndex: number,
    deposit: { actualSelic: number; actualCDB: number },
    notes?: string,
  ) => void;
  updateNotes: (monthKey: string, notes: string) => void;
  toggleCompleted: (monthKey: string) => void;
  /**
   * Persiste vários aportes do mesmo mês em uma única operação.
   * - Atualiza o estado local de forma otimista (cada contribuinte).
   * - Faz UMA única chamada de RPC `upsert_month_with_members`.
   * - Se `markCompleted` for true e o mês ainda não estiver concluído,
   *   o status é gravado como "completed" no mesmo write.
   * - Resolve com `{ ok: true }` quando a persistência (ou enfileiramento
   *   offline) é confirmada, `{ ok: false, reason }` caso contrário.
   */
  saveMonthDepositsBatch: (
    monthKey: string,
    deposits: Array<{ contributorIndex: number; deposit: { actualSelic: number; actualCDB: number } }>,
    options?: { markCompleted?: boolean; notes?: string },
  ) => Promise<{ ok: true; queuedOffline: boolean } | { ok: false; reason: string }>;
}

export function useTrackingActions(deps: Deps): TrackingActions {
  const {
    user, planId, members, config, monthRecords,
    updateMonthRecordLocal, updateMonthNotesLocal, toggleMonthCompletedLocal,
  } = deps;
  const writer = useMonthlyTrackingWriter();
  const offlineQueue = useOfflineQueue();

  const buildRecord = useCallback((monthKey: string): MonthRecord => {
    const existing = monthRecords.find((r) => r.monthKey === monthKey);
    const length = Math.max(1, members.length, config.contributors.length);
    return existing ?? {
      monthKey,
      deposits: Array.from({ length }, () => ({ actualSelic: 0, actualCDB: 0 })),
      notes: "",
      completed: false,
    };
  }, [monthRecords, members.length, config.contributors.length]);

  const persistMonth = useCallback(async (record: MonthRecord) => {
    if (!user || !planId || members.length === 0) return;
    const [year, month] = record.monthKey.split("-").map(Number);
    const ordered = [...members].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    const memberInputs = ordered.map((m, idx) => {
      const contrib = config.contributors[idx];
      const dep = record?.deposits[idx];
      return {
        planMemberId: m.id,
        plannedSelic: contrib?.plannedSelic ?? 0,
        plannedCDB: contrib?.plannedCDB ?? 0,
        actualSelic: dep?.actualSelic ?? 0,
        actualCDB: dep?.actualCDB ?? 0,
      };
    });
    const plannedTotal = memberInputs.reduce((s, m) => s + m.plannedSelic + m.plannedCDB, 0);
    const actualTotal = memberInputs.reduce((s, m) => s + m.actualSelic + m.actualCDB, 0);
    const status = record.completed ? "completed" : actualTotal <= 0 ? "pending" : actualTotal >= plannedTotal && plannedTotal > 0 ? "completed" : "partial";

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({
        entity: "monthly_tracking",
        op: "update",
        entityId: `${planId}:${record.monthKey}`,
        planId,
        memberId: null,
        payload: {
          user_id: user.id,
          plan_id: planId,
          year,
          month,
          month_key: record.monthKey,
          planned_total: plannedTotal,
          actual_total: actualTotal,
          shortfall: Math.max(0, plannedTotal - actualTotal),
          status,
          notes: record.notes ?? null,
          member_inputs: memberInputs.map((m) => ({
            plan_member_id: m.planMemberId,
            planned_selic: m.plannedSelic,
            planned_cdb: m.plannedCDB,
            actual_selic: m.actualSelic,
            actual_cdb: m.actualCDB,
          })),
        },
      });
      toast.success("Sem conexão — registraremos este mês quando a internet voltar.");
      logger.warn("writer.monthly_tracking.offline.enqueued", { userId: user.id, planId, monthKey: record.monthKey });
      return;
    }

    const result = await writer.upsertMonth(planId, record.monthKey, memberInputs, record.notes ?? "", record.completed);
    if (result.error) {
      toast.error("Não conseguimos salvar este mês agora.");
      logger.warn("writer.monthly_tracking.fail", { userId: user.id, planId, monthKey: record.monthKey }, result.error);
    }
  }, [user, planId, members, config.contributors, writer, offlineQueue]);

  const updateMonth = useCallback<TrackingActions["updateMonth"]>((monthKey, idx, deposit, notes) => {
    const base = buildRecord(monthKey);
    const deposits = [...base.deposits];
    while (deposits.length <= idx) deposits.push({ actualSelic: 0, actualCDB: 0 });
    deposits[idx] = deposit;
    const nextRecord = { ...base, deposits, notes: notes !== undefined ? notes : base.notes };
    updateMonthRecordLocal(monthKey, idx, deposit, notes);
    void persistMonth(nextRecord);
  }, [buildRecord, updateMonthRecordLocal, persistMonth]);

  const updateNotes = useCallback<TrackingActions["updateNotes"]>((monthKey, notes) => {
    const nextRecord = { ...buildRecord(monthKey), notes };
    updateMonthNotesLocal(monthKey, notes);
    void persistMonth(nextRecord);
  }, [buildRecord, updateMonthNotesLocal, persistMonth]);

  const toggleCompleted = useCallback<TrackingActions["toggleCompleted"]>((monthKey) => {
    const base = buildRecord(monthKey);
    const nextRecord = { ...base, completed: !base.completed };
    toggleMonthCompletedLocal(monthKey);
    void persistMonth(nextRecord);
  }, [buildRecord, toggleMonthCompletedLocal, persistMonth]);

  const saveMonthDepositsBatch = useCallback<TrackingActions["saveMonthDepositsBatch"]>(
    async (monthKey, depositsByContributor, options) => {
      if (!user || !planId || members.length === 0) {
        return { ok: false, reason: "not_ready" };
      }
      const base = buildRecord(monthKey);
      const deposits = [...base.deposits];
      for (const { contributorIndex, deposit } of depositsByContributor) {
        while (deposits.length <= contributorIndex) deposits.push({ actualSelic: 0, actualCDB: 0 });
        deposits[contributorIndex] = deposit;
      }
      const willComplete = options?.markCompleted === true ? true : base.completed === true;
      const nextRecord: MonthRecord = {
        ...base,
        deposits,
        notes: options?.notes ?? base.notes,
        completed: willComplete,
      };

      // Otimista no local — uma atualização por contribuidor para manter
      // os subscribers (gráficos, totais) coerentes sem flicker.
      depositsByContributor.forEach(({ contributorIndex, deposit }) => {
        updateMonthRecordLocal(monthKey, contributorIndex, deposit, options?.notes);
      });
      if (options?.markCompleted === true && base.completed !== true) {
        toggleMonthCompletedLocal(monthKey);
      }

      // Caminho offline — enfileira em vez de gravar.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        try {
          const [year, month] = monthKey.split("-").map(Number);
          const ordered = [...members].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
          const memberInputs = ordered.map((m, idx) => {
            const contrib = config.contributors[idx];
            const dep = nextRecord.deposits[idx];
            return {
              plan_member_id: m.id,
              planned_selic: contrib?.plannedSelic ?? 0,
              planned_cdb: contrib?.plannedCDB ?? 0,
              actual_selic: dep?.actualSelic ?? 0,
              actual_cdb: dep?.actualCDB ?? 0,
            };
          });
          const plannedTotal = memberInputs.reduce((s, m) => s + m.planned_selic + m.planned_cdb, 0);
          const actualTotal = memberInputs.reduce((s, m) => s + m.actual_selic + m.actual_cdb, 0);
          const status = nextRecord.completed
            ? "completed"
            : actualTotal <= 0
              ? "pending"
              : actualTotal >= plannedTotal && plannedTotal > 0 ? "completed" : "partial";
          await offlineQueue.enqueue({
            entity: "monthly_tracking",
            op: "update",
            entityId: `${planId}:${monthKey}`,
            planId,
            memberId: null,
            payload: {
              user_id: user.id,
              plan_id: planId,
              year, month, month_key: monthKey,
              planned_total: plannedTotal,
              actual_total: actualTotal,
              shortfall: Math.max(0, plannedTotal - actualTotal),
              status,
              notes: nextRecord.notes ?? null,
              member_inputs: memberInputs,
            },
          });
          logger.warn("writer.monthly_tracking.offline.enqueued", { userId: user.id, planId, monthKey });
          return { ok: true, queuedOffline: true };
        } catch (err) {
          logger.warn("writer.monthly_tracking.offline.enqueue.fail", { userId: user.id, planId, monthKey }, err);
          return { ok: false, reason: "offline_enqueue_failed" };
        }
      }

      // Online: uma única chamada de RPC consolidada.
      const ordered = [...members].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
      const memberInputs = ordered.map((m, idx) => {
        const contrib = config.contributors[idx];
        const dep = nextRecord.deposits[idx];
        return {
          planMemberId: m.id,
          plannedSelic: contrib?.plannedSelic ?? 0,
          plannedCDB: contrib?.plannedCDB ?? 0,
          actualSelic: dep?.actualSelic ?? 0,
          actualCDB: dep?.actualCDB ?? 0,
        };
      });
      const result = await writer.upsertMonth(
        planId,
        monthKey,
        memberInputs,
        nextRecord.notes ?? "",
        nextRecord.completed,
      );
      if (result.error) {
        logger.warn("writer.monthly_tracking.batch.fail", { userId: user.id, planId, monthKey }, result.error);
        return { ok: false, reason: result.error };
      }
      return { ok: true, queuedOffline: false };
    },
    [user, planId, members, config.contributors, buildRecord, updateMonthRecordLocal, toggleMonthCompletedLocal, writer, offlineQueue],
  );

  return { updateMonth, updateNotes, toggleCompleted, saveMonthDepositsBatch };
}
