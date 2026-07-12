/**
 * Ordenação e seleção determinística de candidatos.
 * Regras:
 *  1. Ignora candidatos com estado persistido `completed`, `dismissed`, `not_applicable`
 *     ou `snoozed` com `snoozed_until > now`.
 *  2. Ordena por priority (asc), depois por score (desc), depois por actionKey (asc) para estabilidade.
 *  3. Retorna primária, secundária (categoria diferente) e lista completa elegível.
 */

import {
  NBA_ENGINE_VERSION,
  type NextActionCandidate,
  type NextActionContext,
  type NextBestAction,
  type RankedResult,
  type UserActionState,
} from "../types/nextAction";

export function isEligible(
  candidate: NextActionCandidate,
  storedStates: Map<string, UserActionState>,
  now: Date,
): boolean {
  const state = storedStates.get(candidate.actionKey);
  if (!state) return true;
  if (state.status === "completed" || state.status === "dismissed" || state.status === "not_applicable") {
    return false;
  }
  if (state.status === "snoozed" && state.snoozedUntil) {
    const until = new Date(state.snoozedUntil).getTime();
    if (Number.isFinite(until) && until > now.getTime()) return false;
  }
  return true;
}

function toAction(candidate: NextActionCandidate, ctx: NextActionContext, idx: number): NextBestAction {
  return {
    id: `${candidate.actionKey}#${idx}`,
    actionKey: candidate.actionKey,
    category: candidate.category,
    priority: candidate.priority,
    severity: candidate.severity,
    title: candidate.title,
    description: candidate.description,
    reason: candidate.reason,
    evidence: candidate.evidence,
    calculationSummary: candidate.calculationSummary,
    riskIfIgnored: candidate.riskIfIgnored,
    ctaLabel: candidate.ctaLabel,
    destination: candidate.destination,
    completionCriteria: candidate.completionCriteria,
    educationalTopicId: candidate.educationalTopicId,
    confidence: candidate.confidence,
    missingData: candidate.missingData,
    expiresAt: candidate.expiresAt,
    generatedAt: ctx.now.toISOString(),
    engineVersion: NBA_ENGINE_VERSION,
  };
}

export function rankCandidates(
  candidates: NextActionCandidate[],
  ctx: NextActionContext,
): RankedResult {
  const eligible = candidates
    .filter((c) => isEligible(c, ctx.storedStates, ctx.now))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.score !== b.score) return b.score - a.score;
      return a.actionKey.localeCompare(b.actionKey);
    });

  if (eligible.length === 0) {
    return { primary: null, secondary: null, all: [] };
  }
  const all = eligible.map((c, i) => toAction(c, ctx, i));
  const primary = all[0];
  const secondary = all.find((a) => a.category !== primary.category) ?? null;
  return { primary, secondary, all };
}

export function selectNextBestAction(
  candidates: NextActionCandidate[],
  ctx: NextActionContext,
): NextBestAction | null {
  return rankCandidates(candidates, ctx).primary;
}