/**
 * milestoneService — Controls when milestones trigger.
 * 
 * CRITICAL RULE: Celebration popups ONLY fire for REALIZED milestones.
 * Projected milestones show only informational notices.
 */

import type { CoreMetrics } from "./metricsService";
import type { ProjectionResult } from "./projectionService";

export interface MilestoneCheck {
  value: number;
  isRealized: boolean; // true = real wealth >= value
  isProjected: boolean; // true = projected to reach
  projectedMonths: number | null;
  shouldCelebrate: boolean; // ONLY true if realized and not yet celebrated
}

export interface MilestoneStatus {
  milestones: MilestoneCheck[];
  nextRealized: MilestoneCheck | null;
  nextProjected: MilestoneCheck | null;
  celebrationQueue: MilestoneCheck[]; // milestones that should show popup
}

const MILESTONE_VALUES = [50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000];

export function checkMilestones(
  metrics: CoreMetrics,
  projection: ProjectionResult,
  celebratedValues: number[] = []
): MilestoneStatus {
  const realWealth = metrics.grossWealth; // actual, realized wealth

  const milestones: MilestoneCheck[] = MILESTONE_VALUES.map(value => {
    const isRealized = realWealth >= value;
    const projIdx = projection.nominal.findIndex(p => p.balance >= value);
    const isProjected = projIdx >= 0;
    const projectedMonths = projIdx >= 0 ? projIdx + 1 : null;
    const alreadyCelebrated = celebratedValues.includes(value);
    const shouldCelebrate = isRealized && !alreadyCelebrated;

    return { value, isRealized, isProjected, projectedMonths, shouldCelebrate };
  });

  const celebrationQueue = milestones.filter(m => m.shouldCelebrate);
  const nextRealized = milestones.find(m => !m.isRealized && m.isProjected) || null;
  const nextProjected = milestones.find(m => !m.isRealized) || null;

  return { milestones, nextRealized, nextProjected, celebrationQueue };
}

/**
 * Returns a message for projected milestones — informational only, no celebration.
 */
export function getProjectedMilestoneMessage(check: MilestoneCheck, isCouple: boolean): string {
  if (!check.isProjected || check.isRealized) return "";
  const subject = isCouple ? "O plano de vocês" : "Seu plano";
  const months = check.projectedMonths!;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const timeStr = years > 0
    ? `${years} ano${years > 1 ? "s" : ""}${remMonths > 0 ? ` e ${remMonths} meses` : ""}`
    : `${remMonths} meses`;
  return `${subject} projeta alcançar R$ ${(check.value / 1000).toFixed(0)}k em ~${timeStr} no cenário base nominal.`;
}
