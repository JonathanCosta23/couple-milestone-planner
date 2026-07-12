import { describe, it, expect } from "vitest";
import { isEligible } from "../services/nextActionRanking";
import { buildConditionSignature } from "../services/nextActionSignature";
import {
  NBA_SIGNATURE_VERSION,
  type NextActionCandidate,
  type UserActionState,
} from "../types/nextAction";

function cand(over: Partial<NextActionCandidate> = {}): NextActionCandidate {
  return {
    actionKey: "reserve:gap:plan-1",
    category: "emergency_fund",
    priority: 4,
    severity: "high",
    title: "t",
    description: "d",
    reason: "r",
    evidence: [],
    riskIfIgnored: "risk",
    ctaLabel: "cta",
    destination: { tab: "mais" },
    completionCriteria: "c",
    confidence: "high",
    score: 70,
    ...over,
  };
}

describe("ranking · invalidação por assinatura", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("estado dismissed com mesma assinatura suprime o candidato", () => {
    const c = cand();
    const sig = buildConditionSignature(c);
    const stored = new Map<string, UserActionState>();
    stored.set(c.actionKey, {
      actionKey: c.actionKey,
      status: "dismissed",
      conditionSignature: sig,
      conditionVersion: NBA_SIGNATURE_VERSION,
    });
    expect(isEligible(c, stored, now)).toBe(false);
  });

  it("estado dismissed com assinatura antiga é invalidado (candidato reaparece)", () => {
    const c = cand({ severity: "medium" }); // gera assinatura diferente
    const stored = new Map<string, UserActionState>();
    stored.set(c.actionKey, {
      actionKey: c.actionKey,
      status: "dismissed",
      conditionSignature: "sig-v1:deadbeefdeadbeef",
      conditionVersion: NBA_SIGNATURE_VERSION,
    });
    expect(isEligible(c, stored, now)).toBe(true);
  });

  it("estado snoozed com assinatura antiga não bloqueia o candidato", () => {
    const c = cand();
    const future = new Date(now.getTime() + 86_400_000).toISOString();
    const stored = new Map<string, UserActionState>();
    stored.set(c.actionKey, {
      actionKey: c.actionKey,
      status: "snoozed",
      snoozedUntil: future,
      conditionSignature: "sig-v1:0000000000000001",
      conditionVersion: NBA_SIGNATURE_VERSION,
    });
    expect(isEligible(c, stored, now)).toBe(true);
  });

  it("estado legado sem assinatura ainda é respeitado", () => {
    const c = cand();
    const stored = new Map<string, UserActionState>();
    stored.set(c.actionKey, {
      actionKey: c.actionKey,
      status: "dismissed",
    });
    expect(isEligible(c, stored, now)).toBe(false);
  });
});