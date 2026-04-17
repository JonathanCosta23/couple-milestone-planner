/**
 * useDataHydration — Carrega income/expenses/debts/monthly_tracking
 * das tabelas normalizadas para o appData/planData ao logar.
 *
 * Política de merge:
 * - Se as tabelas têm dados, elas vencem (fonte única de verdade).
 * - Se as tabelas estão vazias mas o blob/local tem coisas, NÃO sobrescreve;
 *   o BlobMigrationDialog cuida de oferecer migração assistida.
 *
 * Idempotente: roda 1x por (user.id, plan.id) e sai. Pode ser disparado
 * de novo após uma migração.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData, Income, Expense, Debt } from "@/lib/models";
import type { MonthRecord, PlanData } from "@/lib/types";
import { useIncomeWriter, incomeRowToModel } from "@/hooks/useIncomeWriter";
import { useExpenseWriter, expenseRowToModel } from "@/hooks/useExpenseWriter";
import { useDebtWriter, debtRowToModel } from "@/hooks/useDebtWriter";
import { useMonthlyTrackingWriter } from "@/hooks/useMonthlyTrackingWriter";
import type { PlanMemberRow } from "@/hooks/usePlan";

interface HydrationParams {
  userId: string | undefined;
  planId: string | undefined;
  members: PlanMemberRow[];
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  setPlanData: (mutator: (prev: PlanData) => PlanData) => void;
}

interface HydrationStatus {
  hydrated: boolean;
  loading: boolean;
  counts: { incomes: number; expenses: number; debts: number; months: number };
  error: string | null;
}

export function useDataHydration({
  userId, planId, members, setAppData, setPlanData,
}: HydrationParams): HydrationStatus {
  const incomeWriter = useIncomeWriter();
  const expenseWriter = useExpenseWriter();
  const debtWriter = useDebtWriter();
  const trackingWriter = useMonthlyTrackingWriter();

  const [status, setStatus] = useState<HydrationStatus>({
    hydrated: false, loading: false,
    counts: { incomes: 0, expenses: 0, debts: 0, months: 0 },
    error: null,
  });
  const ranKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !planId) return;
    const key = `${userId}::${planId}`;
    if (ranKeyRef.current === key) return;
    ranKeyRef.current = key;

    let cancelled = false;
    (async () => {
      setStatus((s) => ({ ...s, loading: true, error: null }));
      try {
        const [incRes, expRes, debtRes, monthsRes] = await Promise.all([
          incomeWriter.listIncome(planId),
          expenseWriter.listExpenses(planId),
          debtWriter.listDebts(planId),
          trackingWriter.listMonthlyTracking(planId),
        ]);

        if (cancelled) return;

        const incomes = (incRes.data ?? []).map(incomeRowToModel);
        const expenses = (expRes.data ?? []).map(expenseRowToModel);
        const debts = (debtRes.data ?? []).map(debtRowToModel);
        const months = monthsRes.data ?? [];

        // Carrega depósitos por membro para reconstruir MonthRecord[]
        const monthIds = months.map((m) => m.id);
        const memberDeposits = await trackingWriter.listMemberTracking(monthIds);
        const depositsByMonth = new Map<string, typeof memberDeposits.data>();
        (memberDeposits.data ?? []).forEach((d) => {
          const list = depositsByMonth.get(d.monthly_tracking_id) ?? [];
          list.push(d);
          depositsByMonth.set(d.monthly_tracking_id, list);
        });

        // Mapa plan_member_id → índice no array de contributors
        const memberIndexMap = new Map<string, number>();
        const orderedMembers = [...members].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
        orderedMembers.forEach((m, idx) => memberIndexMap.set(m.id, idx));
        const numContributors = Math.max(1, orderedMembers.length);

        const monthRecords: MonthRecord[] = months.map((m) => {
          const deposits = Array.from({ length: numContributors }, () => ({ actualSelic: 0, actualCDB: 0 }));
          (depositsByMonth.get(m.id) ?? []).forEach((d) => {
            const idx = memberIndexMap.get(d.plan_member_id);
            if (idx !== undefined) {
              deposits[idx] = {
                actualSelic: Number(d.actual_selic ?? 0),
                actualCDB: Number(d.actual_cdb ?? 0),
              };
            }
          });
          return {
            monthKey: m.month_key,
            deposits,
            notes: m.notes ?? "",
            completed: m.status === "completed",
          };
        });

        // Aplica no estado: tabelas vencem se tiverem dados.
        setAppData((prev) => ({
          ...prev,
          incomes: incomes.length > 0 ? incomes : prev.incomes,
          expenses: expenses.length > 0 ? expenses : prev.expenses,
          debts: debts.length > 0 ? debts : prev.debts,
        }));

        if (monthRecords.length > 0) {
          setPlanData((prev) => ({ ...prev, monthRecords }));
        }

        setStatus({
          hydrated: true,
          loading: false,
          counts: {
            incomes: incomes.length,
            expenses: expenses.length,
            debts: debts.length,
            months: monthRecords.length,
          },
          error:
            incRes.error || expRes.error || debtRes.error || monthsRes.error || null,
        });
      } catch (err) {
        if (cancelled) return;
        setStatus((s) => ({ ...s, loading: false, error: (err as Error).message }));
      }
    })();

    return () => { cancelled = true; };
  }, [userId, planId, members, setAppData, setPlanData, incomeWriter, expenseWriter, debtWriter, trackingWriter]);

  /** Permite forçar re-hidratação (ex.: depois de migrar o blob). */
  const forceRefresh = useCallback(() => {
    ranKeyRef.current = null;
    setStatus((s) => ({ ...s, hydrated: false }));
  }, []);

  return { ...status, forceRefresh } as HydrationStatus & { forceRefresh: () => void };
}
