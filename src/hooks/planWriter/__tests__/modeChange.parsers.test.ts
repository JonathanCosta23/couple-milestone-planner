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
  it("rejeita removed_partner_id ausente", () => {
    const r = parseRemovePartnerPayload({ plan_id: "p1", mode: "individual" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_rpc_payload");
  });
  it("rejeita removed_partner_id null", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: null }).ok).toBe(false);
  });
  it("rejeita removed_partner_id string vazia", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: "" }).ok).toBe(false);
  });
  it("rejeita removed_partner_id numérico", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: 42 }).ok).toBe(false);
  });
  it("rejeita removed_partner_id de outros tipos", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: {} }).ok).toBe(false);
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: [] }).ok).toBe(false);
  });
  it("aceita removed_partner_id string", () => {
    const r = parseRemovePartnerPayload({ plan_id: "p1", mode: "individual", removed_partner_id: "old" });
    expect(r.ok).toBe(true);
    expect(r.value?.removedPartnerId).toBe("old");
  });
  it("rejeita mode inválido", () => {
    expect(parseRemovePartnerPayload({ plan_id: "p1", mode: "solo", removed_partner_id: "x" }).ok).toBe(false);
  });
});

describe("parseNormalizePayload", () => {
  it("individual válido 1/0", () => {
    const r = parseNormalizePayload({ mode: "individual", primary_active: 1, partner_active: 0 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ mode: "individual", primaryActiveCount: 1, partnerActiveCount: 0 });
  });
  it("casal válido 1/1", () => {
    const r = parseNormalizePayload({ mode: "casal", primary_active: 1, partner_active: 1 });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ mode: "casal", primaryActiveCount: 1, partnerActiveCount: 1 });
  });
  it("rejeita mode ausente ou inválido", () => {
    expect(parseNormalizePayload({}).ok).toBe(false);
    expect(parseNormalizePayload({ mode: "solo", primary_active: 1, partner_active: 0 }).ok).toBe(false);
    expect(parseNormalizePayload(null).ok).toBe(false);
  });
  it("rejeita quando primary_active está ausente", () => {
    expect(parseNormalizePayload({ mode: "individual", partner_active: 0 }).ok).toBe(false);
  });
  it("rejeita quando partner_active está ausente", () => {
    expect(parseNormalizePayload({ mode: "individual", primary_active: 1 }).ok).toBe(false);
  });
  it("rejeita contagens string", () => {
    expect(parseNormalizePayload({ mode: "individual", primary_active: "1", partner_active: 0 }).ok).toBe(false);
    expect(parseNormalizePayload({ mode: "individual", primary_active: 1, partner_active: "0" }).ok).toBe(false);
  });
  it("rejeita contagens negativas", () => {
    expect(parseNormalizePayload({ mode: "individual", primary_active: -1, partner_active: 0 }).ok).toBe(false);
  });
  it("rejeita contagens fracionárias", () => {
    expect(parseNormalizePayload({ mode: "casal", primary_active: 1.5, partner_active: 1 }).ok).toBe(false);
  });
  it("rejeita casal com contagem 1/0", () => {
    expect(parseNormalizePayload({ mode: "casal", primary_active: 1, partner_active: 0 }).ok).toBe(false);
  });
  it("rejeita individual com contagem 1/1", () => {
    expect(parseNormalizePayload({ mode: "individual", primary_active: 1, partner_active: 1 }).ok).toBe(false);
  });
});
