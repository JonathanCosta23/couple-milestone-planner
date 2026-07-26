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
  it("rejeita null", () => {
    expect(parseAddPartnerPayload(null)).toEqual({ ok: false, value: null, error: "invalid_rpc_payload" });
  });
  it("rejeita undefined", () => {
    expect(parseAddPartnerPayload(undefined)).toEqual({ ok: false, value: null, error: "invalid_rpc_payload" });
  });
  it("rejeita string", () => {
    expect(parseAddPartnerPayload("oops")).toEqual({ ok: false, value: null, error: "invalid_rpc_payload" });
  });
  it("rejeita chaves ausentes", () => {
    expect(parseAddPartnerPayload({ plan_id: "p1" })).toEqual({ ok: false, value: null, error: "invalid_rpc_payload" });
    expect(parseAddPartnerPayload({ plan_id: "p1", mode: "casal" })).toEqual({ ok: false, value: null, error: "invalid_rpc_payload" });
  });
  it("rejeita tipos incorretos", () => {
    expect(parseAddPartnerPayload({ plan_id: 1, mode: "casal", partner_id: "x" })).toEqual({ ok: false, value: null, error: "invalid_rpc_payload" });
    expect(parseAddPartnerPayload({ plan_id: "p1", mode: "solo", partner_id: "x" })).toEqual({ ok: false, value: null, error: "invalid_rpc_payload" });
  });
  it("aceita payload válido", () => {
    const r = parseAddPartnerPayload({ plan_id: "p1", mode: "casal", partner_id: "m2", partner: {} });
    expect(r).toEqual({ ok: true, value: { planId: "p1", mode: "casal", partnerId: "m2", error: null } });
  });
});

describe("parseRemovePartnerPayload", () => {
  it("rejeita null/undefined", () => {
    expect(parseRemovePartnerPayload(null).ok).toBe(false);
    expect(parseRemovePartnerPayload(undefined).ok).toBe(false);
  });
  it("aceita removed_partner_id null", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: null })).toEqual({
      ok: true, value: { planId: "p1", mode: "individual", removedPartnerId: null },
    });
  });
  it("aceita removed_partner_id string", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: "old" })).toEqual({
      ok: true, value: { planId: "p1", mode: "individual", removedPartnerId: "old" },
    });
  });
  it("rejeita removed_partner_id de tipo inválido", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: 42 }).ok).toBe(false);
  });
});

describe("parseNormalizePayload", () => {
  it("aceita mode válido", () => {
    expect(parseNormalizePayload({ mode: "casal" })).toEqual({ ok: true, value: { mode: "casal", error: null } });
    expect(parseNormalizePayload({ mode: "individual" })).toEqual({ ok: true, value: { mode: "individual", error: null } });
  });
  it("rejeita mode ausente ou inválido", () => {
    expect(parseNormalizePayload({}).ok).toBe(false);
    expect(parseNormalizePayload({ mode: "solo" }).ok).toBe(false);
    expect(parseNormalizePayload(null).ok).toBe(false);
  });
});
