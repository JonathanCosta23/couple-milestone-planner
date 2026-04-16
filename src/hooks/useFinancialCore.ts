/**
 * useFinancialCore — The single hook every screen should use.
 * Computes all derived metrics from the current data state.
 * No screen should recalculate metrics independently.
 *
 * Fase 1.C: aceita opcionalmente `cloudPlan` vindo de `usePlan` para que o modo
 * do plano e os nomes dos membros venham da fonte canônica (Supabase). Quando
 * presente, esses dados sobrescrevem `appData.mode` / `primaryProfile.name` /
 * `partner.profile.name` antes do cálculo de métricas. Componentes que ainda
 * leem `appData` continuam funcionando via o adapter `applyCloudPlanToAppData`.
 */

import { useMemo } from "react";
import type { AppData } from "@/lib/models";
import type { PlanConfig, MonthRecord, FinancialProfile } from "@/lib/types";
import { calculateCoreMetrics, type CoreMetrics } from "@/lib/services/metricsService";
import { calculateProjection, type ProjectionResult } from "@/lib/services/projectionService";
import { analyzeAllocation, type AllocationAnalysis } from "@/lib/services/allocationService";
import { detectJourneyState, type JourneyState } from "@/lib/services/journeyService";
import { generateInsights, type InsightsResult } from "@/lib/services/insightsService";
import { checkMilestones, type MilestoneStatus } from "@/lib/services/milestoneService";
import type { PlanRow, PlanMemberRow } from "@/hooks/usePlan";

export interface FinancialCoreState {
  metrics: CoreMetrics;
  projection: ProjectionResult;
  projectionActual: ProjectionResult;
  allocation: AllocationAnalysis;
  journey: JourneyState;
  insights: InsightsResult;
  milestones: MilestoneStatus;
  /** AppData efetivo após overlay com dados canônicos da nuvem. */
  effectiveAppData: AppData;
}

export interface CloudPlanOverlay {
  plan: PlanRow | null;
  members: PlanMemberRow[];
}

interface FinancialCoreInput {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  profile?: FinancialProfile;
  celebratedMilestones?: number[];
  /** Opcional: dados canônicos do Supabase (Fase 1.C). Quando presentes, têm prioridade sobre appData para modo + nomes. */
  cloudPlan?: CloudPlanOverlay | null;
}

/**
 * Adapter público: projeta um AppData "efetivo" combinando AppData local
 * com dados canônicos do Supabase (modo do plano + nomes dos membros).
 * Componentes que ainda recebem appData podem usar este helper para que
 * leiam modo/nomes da fonte de verdade sem precisar adotar usePlan ainda.
 */
export function applyCloudPlanToAppData(
  appData: AppData,
  cloudPlan?: CloudPlanOverlay | null,
): AppData {
  if (!cloudPlan?.plan) return appData;

  const { plan, members } = cloudPlan;
  // Mapeia "individual"/"casal" (canônico) para "solo"/"couple" (legado em AppData).
  const legacyMode = plan.mode === "casal" ? "couple" : "solo";
  const primary = members.find((m) => m.is_primary) ?? members[0];
  const partner = members.find((m) => !m.is_primary && m.is_active);

  return {
    ...appData,
    mode: legacyMode,
    primaryProfile: {
      ...appData.primaryProfile,
      name: primary?.name?.trim() || appData.primaryProfile.name || "Você",
      age: primary?.age ?? appData.primaryProfile.age,
      avatarColor: primary?.avatar_color ?? appData.primaryProfile.avatarColor,
    },
    partner:
      legacyMode === "couple" && partner
        ? {
            profile: {
              id: partner.id,
              name: partner.name?.trim() || "Parceiro(a)",
              age: partner.age ?? undefined,
              avatarColor: partner.avatar_color ?? "hsl(190, 80%, 50%)",
            },
            addedAt: appData.partner?.addedAt ?? new Date().toISOString(),
          }
        : legacyMode === "solo"
        ? undefined
        : appData.partner,
  };
}

export function useFinancialCore({
  appData,
  config,
  monthRecords,
  startDate,
  profile,
  celebratedMilestones = [],
  cloudPlan = null,
}: FinancialCoreInput): FinancialCoreState {
  return useMemo(() => {
    const effectiveAppData = applyCloudPlanToAppData(appData, cloudPlan);

    const metrics = calculateCoreMetrics(effectiveAppData, config, monthRecords, startDate, profile);

    const projection = calculateProjection(config, "planned", monthRecords, startDate, {
      inflationRate: 0.045,
      irRate: 0.15,
    });

    const projectionActual = calculateProjection(config, "actual", monthRecords, startDate, {
      inflationRate: 0.045,
      irRate: 0.15,
    });

    const allocation = analyzeAllocation(effectiveAppData);
    const journey = detectJourneyState(metrics);
    const insights = generateInsights(metrics, journey);
    const milestones = checkMilestones(metrics, projection, celebratedMilestones);

    return {
      metrics,
      projection,
      projectionActual,
      allocation,
      journey,
      insights,
      milestones,
      effectiveAppData,
    };
  }, [appData, config, monthRecords, startDate, profile, celebratedMilestones, cloudPlan]);
}
