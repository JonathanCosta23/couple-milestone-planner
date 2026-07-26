/**
 * Parsers estritos de modeChange — 4.b.1.1-A.
 * Cobrem null, undefined, chaves ausentes e tipos incorretos.
 */
import { describe, it, expect } from "vitest";
import {
  parseAddPartnerPayload,
  parseRemovePartnerPayload,
  parseNormalizePayload,
} from "@/hooks/planWriter/modeChange";

describe("parseAddPartnerPayload", () => {
  it("rejeita null/undefined/primitivos", () => {
    expect(parseAddPartnerPayload(null).ok).toBe(false);
    expect(parseAddPartnerPayload(undefined).ok).toBe(false);
    expect(parseAddPartnerPayload("oops").ok).toBe(false);
    expect(parseAddPartnerPayload(42).ok).toBe(false);
  });
  it("rejeita chaves ausentes", () => {
    expect(parseAddPartnerPayload({ plan_id: "p1" }).ok).toBe(false);
    expect(parseAddPartnerPayload({ plan_id: "p1", mode: "casal" }).ok).toBe(false);
  });
  it("rejeita tipos incorretos", () => {
    expect(parseAddPartnerPayload({ plan_id: 1, mode: "casal", partner_id: "x" }).ok).toBe(false);
    expect(parseAddPartnerPayload({ plan_id: "p1", mode: "solo", partner_id: "x" }).ok).toBe(false);
    expect(parseAddPartnerPayload({ plan_id: "p1", mode: "casal", partner_id: "" }).ok).toBe(false);
  });
  it("aceita payload válido", () => {
    const r = parseAddPartnerPayload({ plan_id: "p1", mode: "casal", partner_id: "m2", partner: {} });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ planId: "p1", mode: "casal", partnerId: "m2" });
    expect(r.error).toBeNull();
  });
  it("payloads inválidos retornam error='invalid_rpc_payload' e value=null", () => {
    const r = parseAddPartnerPayload(null);
    expect(r.error).toBe("invalid_rpc_payload");
    expect(r.value).toBeNull();
  });
});

describe("parseRemovePartnerPayload", () => {
  it("rejeita null/undefined", () => {
    expect(parseRemovePartnerPayload(null).ok).toBe(false);
    expect(parseRemovePartnerPayload(undefined).ok).toBe(false);
  });
  it("aceita removed_partner_id null", () => {
    const r = parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: null });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ planId: "p1", mode: "individual", removedPartnerId: null });
  });
  it("aceita removed_partner_id ausente (interpreta como null)", () => {
    const r = parseRemovePartnerPayload({ plan_id: "p1", mode: "individual" });
    expect(r.ok).toBe(true);
    expect(r.value?.removedPartnerId).toBeNull();
  });
  it("aceita removed_partner_id string", () => {
    const r = parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: "old" });
    expect(r.value?.removedPartnerId).toBe("old");
  });
  it("rejeita removed_partner_id de tipo inválido", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: 42 }).ok).toBe(false);
  });
  it("rejeita mode inválido", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "solo", removed_partner_id: null }).ok).toBe(false);
  });
});

describe("parseNormalizePayload", () => {
  it("aceita mode válido", () => {
    const r1 = parseNormalizePayload({ mode: "casal" });
    expect(r1.ok).toBe(true);
    expect(r1.value).toEqual({ mode: "casal" });
    const r2 = parseNormalizePayload({ mode: "individual" });
    expect(r2.value).toEqual({ mode: "individual" });
  });
  it("rejeita mode ausente ou inválido", () => {
    expect(parseNormalizePayload({}).ok).toBe(false);
    expect(parseNormalizePayload({ mode: "solo" }).ok).toBe(false);
    expect(parseNormalizePayload(null).ok).toBe(false);
  });
});
