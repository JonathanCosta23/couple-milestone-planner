/**
 * useFinancialCore — The single hook every screen should use.
 * Computes all derived metrics from the current data state.
 * No screen should recalculate metrics independently.
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

export interface FinancialCoreState {
  metrics: CoreMetrics;
  projection: ProjectionResult;
  projectionActual: ProjectionResult;
  allocation: AllocationAnalysis;
  journey: JourneyState;
  insights: InsightsResult;
  milestones: MilestoneStatus;
}

interface FinancialCoreInput {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  profile?: FinancialProfile;
  celebratedMilestones?: number[];
}

export function useFinancialCore({
  appData,
  config,
  monthRecords,
  startDate,
  profile,
  celebratedMilestones = [],
}: FinancialCoreInput): FinancialCoreState {
  return useMemo(() => {
    const metrics = calculateCoreMetrics(appData, config, monthRecords, startDate, profile);

    const projection = calculateProjection(config, "planned", monthRecords, startDate, {
      inflationRate: 0.045,
      irRate: 0.15,
    });

    const projectionActual = calculateProjection(config, "actual", monthRecords, startDate, {
      inflationRate: 0.045,
      irRate: 0.15,
    });

    const allocation = analyzeAllocation(appData);
    const journey = detectJourneyState(metrics);
    const insights = generateInsights(metrics, journey);
    const milestones = checkMilestones(metrics, projection, celebratedMilestones);

    return { metrics, projection, projectionActual, allocation, journey, insights, milestones };
  }, [appData, config, monthRecords, startDate, profile, celebratedMilestones]);
}
