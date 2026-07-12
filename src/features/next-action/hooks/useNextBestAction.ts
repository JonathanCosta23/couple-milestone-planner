/**
 * useNextBestAction — orquestra motor + persistência + eventos.
 * NÃO recalcula métricas financeiras; consome as métricas já derivadas do core.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeNextBestAction } from "../services/nextActionEngine";
import {
  loadActionStates,
  logActionEvent,
  markActionShown,
  upsertActionState,
  type NextActionEventType,
} from "../services/nextActionPersistence";
import {
  buildConditionSignature,
  isStoredStateApplicableToCandidate,
} from "../services/nextActionSignature";
import { generateAllCandidates } from "../services/nextActionCandidates";
import type {
  NextActionContext,
  NextBestAction,
  UserActionState,
  UserActionStatus,
  UserLearningLevel,
} from "../types/nextAction";
import type { CoreMetrics } from "@/lib/services/metricsService";
import type { AppData } from "@/lib/models";
import type { PlanConfig, MonthRecord } from "@/lib/types";
import { getCurrentMonthKey } from "@/lib/types";
import { getCurrentMonthDeposited } from "@/lib/calculator";

interface Params {
  userId?: string | null;
  planId: string | null;
  metrics: CoreMetrics;
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  learningLevel?: UserLearningLevel;
  hasCoreDataLoaded?: boolean;
}

export function useNextBestAction(params: Params) {
  const [storedStates, setStoredStates] = useState<Map<string, UserActionState>>(new Map());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!params.userId || !params.planId) {
      setStoredStates(new Map());
      setLoaded(true);
      return;
    }
    const planId = params.planId;
    loadActionStates(params.userId, planId).then((m) => {
      if (!cancelled) {
        setStoredStates(m);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [params.userId, params.planId]);

  const ctx: NextActionContext = useMemo(() => {
    const monthKey = getCurrentMonthKey();
    const currentMonth = getCurrentMonthDeposited(params.config, params.monthRecords);
    const rec = params.monthRecords.find((m) => m.monthKey === monthKey);
    const essentialMonthly = params.metrics.essentialExpenses > 0
      ? params.metrics.essentialExpenses
      : params.metrics.totalExpenses;
    const reserveGap = Math.max(
      0,
      essentialMonthly * params.metrics.reserveGoalMonths - params.metrics.reserveLiquid,
    );
    return {
      now: new Date(),
      planId: params.planId,
      hasCoreDataLoaded: params.hasCoreDataLoaded ?? true,
      metrics: {
        totalIncome: params.metrics.totalIncome,
        totalExpenses: params.metrics.totalExpenses,
        essentialExpenses: params.metrics.essentialExpenses,
        savingsRate: params.metrics.savingsRate,
        monthlyContribution: params.metrics.monthlyContribution,
        reserveMonths: params.metrics.reserveMonths,
        reserveGoalMonths: params.metrics.reserveGoalMonths,
        reserveGap,
        grossWealth: params.metrics.grossWealth,
        toxicDebtCount: params.metrics.toxicDebtCount,
        debtWeight: params.metrics.debtWeight,
        maxConcentrationByInstitution: params.metrics.maxConcentrationByInstitution,
        concentrationInstitution: params.metrics.concentrationInstitution,
      },
      hasBudgetData:
        params.appData.incomes.some((i) => i.active) &&
        params.appData.expenses.some((e) => e.monthKey === monthKey),
      hasIncomeData: params.appData.incomes.some((i) => i.active),
      hasExpenseData: params.appData.expenses.some((e) => e.monthKey === monthKey),
      debts: params.appData.debts
        .filter((d) => d.active)
        .map((d) => ({
          id: d.id,
          label: d.name || d.type || "Dívida",
          monthlyPayment: d.monthlyPayment,
          interestRateAnnual: d.interestRate ?? null,
          risk: d.risk,
          active: d.active,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      currentMonthKey: monthKey,
      currentMonthPlanned: currentMonth.planned,
      currentMonthActual: currentMonth.total,
      currentMonthCompleted: !!rec?.completed,
      learningLevel: params.learningLevel ?? "basic",
      storedStates,
    };
  }, [params, storedStates]);

  const action: NextBestAction | null = useMemo(() => computeNextBestAction(ctx), [ctx]);

  /** Assinatura da ação atual (independente do relógio). */
  const currentSignature = useMemo(() => {
    if (!action) return null;
    // Refaz a busca do candidato correspondente para acessar signatureInputs.
    const candidate = generateAllCandidates(ctx).find((c) => c.actionKey === action.actionKey);
    return candidate ? buildConditionSignature(candidate) : null;
  }, [action, ctx]);

  /** Idempotência do action_shown: um evento por (actionKey, signature) por sessão. */
  const shownRef = useRef<string | null>(null);

  /** Detecta e registra invalidação quando a assinatura persistida diverge. */
  const invalidatedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!params.userId || !params.planId || !action || !currentSignature) return;
    const stored = storedStates.get(action.actionKey);
    if (!stored) return;
    if (isStoredStateApplicableToCandidate(stored, currentSignature)) return;
    const key = `${action.actionKey}|${stored.conditionSignature ?? "∅"}`;
    if (invalidatedRef.current.has(key)) return;
    invalidatedRef.current.add(key);
    logActionEvent({
      userId: params.userId,
      planId: params.planId,
      actionKey: action.actionKey,
      actionCategory: action.category,
      eventType: "action_invalidated",
    });
  }, [params.userId, params.planId, action, currentSignature, storedStates]);

  /** Efeito de exibição: grava markActionShown + evento action_shown idempotente. */
  useEffect(() => {
    if (!params.userId || !params.planId || !action || !currentSignature) return;
    const key = `${action.actionKey}|${currentSignature}`;
    if (shownRef.current === key) return;
    shownRef.current = key;
    const userId = params.userId;
    const planId = params.planId;
    markActionShown({
      userId,
      planId,
      actionKey: action.actionKey,
      actionCategory: action.category,
      conditionSignature: currentSignature,
    }).then(() => {
      logActionEvent({
        userId,
        planId,
        actionKey: action.actionKey,
        actionCategory: action.category,
        eventType: "action_shown",
      });
    });
  }, [params.userId, params.planId, action, currentSignature]);

  const logEvent = useCallback(
    (eventType: NextActionEventType) => {
      if (!params.userId || !params.planId || !action) return;
      logActionEvent({
        userId: params.userId,
        planId: params.planId,
        actionKey: action.actionKey,
        actionCategory: action.category,
        eventType,
      });
    },
    [params.userId, params.planId, action],
  );

  const updateStatus = useCallback(
    async (status: UserActionStatus, opts?: { snoozedUntil?: string | null; reason?: string | null }) => {
      if (!params.userId || !params.planId || !action) return;
      const planId = params.planId;
      await upsertActionState({
        userId: params.userId,
        planId,
        actionKey: action.actionKey,
        actionCategory: action.category,
        status,
        snoozedUntil: opts?.snoozedUntil ?? null,
        dismissedReason: opts?.reason ?? null,
        conditionSignature: currentSignature,
      });
      setStoredStates((prev) => {
        const next = new Map(prev);
        next.set(action.actionKey, {
          actionKey: action.actionKey,
          status,
          snoozedUntil: opts?.snoozedUntil ?? null,
          dismissedReason: opts?.reason ?? null,
          completedAt: status === "completed" ? new Date().toISOString() : null,
          conditionSignature: currentSignature,
        });
        return next;
      });
      const evt: NextActionEventType =
        status === "completed" ? "action_completed"
        : status === "snoozed" ? "action_snoozed"
        : status === "dismissed" ? "action_dismissed"
        : status === "not_applicable" ? "action_dismissed"
        : "action_invalidated";
      logActionEvent({
        userId: params.userId,
        planId,
        actionKey: action.actionKey,
        actionCategory: action.category,
        eventType: evt,
      });
    },
    [params.userId, params.planId, action, currentSignature],
  );

  return {
    action,
    loaded,
    complete: () => updateStatus("completed"),
    snoozeUntil: (iso: string) => updateStatus("snoozed", { snoozedUntil: iso }),
    dismiss: (reason?: string) => updateStatus("dismissed", { reason }),
    markNotApplicable: (reason?: string) => updateStatus("not_applicable", { reason }),
    logEvent,
  };
}