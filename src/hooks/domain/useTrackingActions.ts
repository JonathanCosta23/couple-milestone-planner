/**
 * useTrackingActions — handler de domínio para acompanhamento mensal.
 * Persiste mês inteiro de forma idempotente (planejado + realizado por membro).
 */
import { useCallback } from "react";
import type { MonthRecord, PlanConfig } from "@/lib/types";
import type { PlanMemberRow } from "@/hooks/usePlan";
import { useMonthlyTrackingWriter } from "@/hooks/useMonthlyTrackingWriter";

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
}

export function useTrackingActions(deps: Deps): TrackingActions {
  const {
    user, planId, members, config, monthRecords,
    updateMonthRecordLocal, updateMonthNotesLocal, toggleMonthCompletedLocal,
  } = deps;
  const writer = useMonthlyTrackingWriter();

  const persistMonth = useCallback(async (monthKey: string) => {
    if (!user || !planId || members.length === 0) return;
    const record = monthRecords.find((r) => r.monthKey === monthKey);
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
    await writer.upsertMonth(planId, monthKey, memberInputs, record?.notes ?? "", record?.completed);
  }, [user, planId, members, monthRecords, config.contributors, writer]);

  const updateMonth = useCallback<TrackingActions["updateMonth"]>((monthKey, idx, deposit, notes) => {
    updateMonthRecordLocal(monthKey, idx, deposit, notes);
    setTimeout(() => { void persistMonth(monthKey); }, 0);
  }, [updateMonthRecordLocal, persistMonth]);

  const updateNotes = useCallback<TrackingActions["updateNotes"]>((monthKey, notes) => {
    updateMonthNotesLocal(monthKey, notes);
    if (user && planId) void writer.updateMonthNotes(planId, monthKey, notes);
  }, [updateMonthNotesLocal, user, planId, writer]);

  const toggleCompleted = useCallback<TrackingActions["toggleCompleted"]>((monthKey) => {
    toggleMonthCompletedLocal(monthKey);
    setTimeout(() => { void persistMonth(monthKey); }, 0);
  }, [toggleMonthCompletedLocal, persistMonth]);

  return { updateMonth, updateNotes, toggleCompleted };
}
