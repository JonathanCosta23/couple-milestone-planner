import { describe, it, expect } from "vitest";
import {
  buildConditionSignature,
  isStoredStateApplicableToCandidate,
} from "../services/nextActionSignature";
import {
  NBA_SIGNATURE_VERSION,
  type NextActionCandidate,
  type UserActionState,
} from "../types/nextAction";

function candidate(over: Partial<NextActionCandidate> = {}): NextActionCandidate {
  return {
    actionKey: "debt:review:d1",
    category: "debt",
    priority: 2,
    severity: "critical",
    title: "t",
    description: "d",
    reason: "r",
    evidence: [],
    riskIfIgnored: "risk",
    ctaLabel: "cta",
    destination: { tab: "execucao" },
    completionCriteria: "c",
    confidence: "high",
    score: 90,
    ...over,
  };
}

describe("buildConditionSignature", () => {
  it("é determinística: mesma entrada => mesma assinatura", () => {
    const a = buildConditionSignature(candidate());
    const b = buildConditionSignature(candidate());
    expect(a).toBe(b);
  });

  it("independe da ordem das chaves em signatureInputs", () => {
    const a = buildConditionSignature(
      candidate({ signatureInputs: { a: 1, b: 2, c: 3 } }),
    );
    const b = buildConditionSignature(
      candidate({ signatureInputs: { c: 3, b: 2, a: 1 } }),
    );
    expect(a).toBe(b);
  });

  it("independe da ordem das coleções (arrays)", () => {
    const a = buildConditionSignature(
      candidate({ missingData: ["debt_rate", "income"] }),
    );
    const b = buildConditionSignature(
      candidate({ missingData: ["income", "debt_rate"] }),
    );
    expect(a).toBe(b);
  });

  it("muda quando um input material muda", () => {
    const a = buildConditionSignature(candidate({ severity: "high" }));
    const b = buildConditionSignature(candidate({ severity: "medium" }));
    expect(a).not.toBe(b);
  });

  it("prefixo carrega a versão da assinatura", () => {
    const sig = buildConditionSignature(candidate());
    expect(sig.startsWith(`${NBA_SIGNATURE_VERSION}:`)).toBe(true);
  });

  it("não expõe valores financeiros em texto legível", () => {
    const sig = buildConditionSignature(
      candidate({ signatureInputs: { reserveGap: 12345.67, contribution: 999.99 } }),
    );
    expect(sig).not.toContain("12345");
    expect(sig).not.toContain("999.99");
    expect(/^sig-v1:[0-9a-f]{16}$/.test(sig)).toBe(true);
  });
});

describe("isStoredStateApplicableToCandidate", () => {
  const sig = buildConditionSignature(candidate());

  it("estado ausente é aplicável (nada a suprimir)", () => {
    expect(isStoredStateApplicableToCandidate(undefined, sig)).toBe(true);
  });

  it("estado com mesma assinatura é aplicável", () => {
    const state: UserActionState = {
      actionKey: "debt:review:d1",
      status: "snoozed",
      conditionSignature: sig,
      conditionVersion: NBA_SIGNATURE_VERSION,
    };
    expect(isStoredStateApplicableToCandidate(state, sig)).toBe(true);
  });

  it("estado com assinatura diferente é invalidado", () => {
    const state: UserActionState = {
      actionKey: "debt:review:d1",
      status: "dismissed",
      conditionSignature: "sig-v1:0000000000000000",
      conditionVersion: NBA_SIGNATURE_VERSION,
    };
    expect(isStoredStateApplicableToCandidate(state, sig)).toBe(false);
  });

  it("estado com versão diferente é invalidado", () => {
    const state: UserActionState = {
      actionKey: "debt:review:d1",
      status: "dismissed",
      conditionSignature: sig,
      conditionVersion: "sig-v0",
    };
    expect(isStoredStateApplicableToCandidate(state, sig)).toBe(false);
  });

  it("estado legado sem assinatura permanece aplicável", () => {
    const state: UserActionState = {
      actionKey: "debt:review:d1",
      status: "dismissed",
    };
    expect(isStoredStateApplicableToCandidate(state, sig)).toBe(true);
  });
});