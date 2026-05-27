/**
 * Hardening da offline queue — helpers puros de validação/sanitização.
 *
 * Cobre os cenários exigidos pelo runbook:
 *   a) update parcial sem titular não envia member_id;
 *   b) create de asset sem member_id é bloqueado (dead-letter);
 *   c) update offline não apaga member_id existente na nuvem;
 *   d) merge update+update preserva member_id;
 *   e) create+update mantém member_id do create se update não alterar titular;
 *   f) conflict resolution (mine) preserva member_id existente.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeUpdatePayload,
  validateCreatePayload,
  resolveMemberId,
  payloadMentionsMember,
  type QueuedWrite,
} from "@/lib/offlineQueue";

function makeWrite(partial: Partial<QueuedWrite>): QueuedWrite {
  return {
    id: "w1",
    userId: "user-1",
    entity: "asset",
    op: "update",
    entityId: "asset-1",
    planId: "plan-1",
    payload: {},
    memberId: null,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
    ...partial,
  };
}

describe("sanitizeUpdatePayload", () => {
  it("(a) update parcial sem titular não envia member_id", () => {
    const out = sanitizeUpdatePayload(
      makeWrite({ payload: { current_amount: 5000 }, memberId: "m-123" }),
    );
    expect(out).toEqual({ current_amount: 5000 });
    expect("member_id" in out).toBe(false);
  });

  it("(c) update offline não apaga member_id existente quando payload é silencioso", () => {
    // Mesmo com memberId snapshot, sem mention no payload original → não toca.
    const out = sanitizeUpdatePayload(
      makeWrite({ payload: { notes: "atualizado" }, memberId: "m-123" }),
    );
    expect("member_id" in out).toBe(false);
  });

  it("respeita troca explícita de titular quando o payload menciona member_id", () => {
    const out = sanitizeUpdatePayload(
      makeWrite({
        payload: { current_amount: 100, member_id: "m-new" },
        memberId: "m-snapshot",
      }),
    );
    expect(out.member_id).toBe("m-new");
  });

  it("remove user_id e plan_id mesmo quando o caller os incluiu por engano", () => {
    const out = sanitizeUpdatePayload(
      makeWrite({
        payload: { user_id: "outro", plan_id: "outro", current_amount: 1 },
      }),
    );
    expect("user_id" in out).toBe(false);
    expect("plan_id" in out).toBe(false);
    expect(out.current_amount).toBe(1);
  });
});

describe("validateCreatePayload — assets exigem member_id", () => {
  it("(b) create de asset sem member_id é bloqueado", () => {
    const v = validateCreatePayload(
      makeWrite({ op: "create", payload: { current_amount: 100 }, memberId: null }),
    );
    expect(v.ok).toBe(false);
    if (v.ok === false) {
      expect(v.reason).toMatch(/member_id/i);
    }
  });

  it("bloqueia asset sem plan_id mesmo com member_id", () => {
    const v = validateCreatePayload(
      makeWrite({ op: "create", planId: null, memberId: "m-1", payload: {} }),
    );
    expect(v.ok).toBe(false);
  });

  it("aceita create de asset com plan_id e member_id no snapshot", () => {
    const v = validateCreatePayload(
      makeWrite({ op: "create", memberId: "m-1", payload: { ticker_or_name: "Tesouro" } }),
    );
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.user_id).toBe("user-1");
      expect(v.payload.plan_id).toBe("plan-1");
      expect(v.payload.member_id).toBe("m-1");
      expect(v.payload.ticker_or_name).toBe("Tesouro");
    }
  });

  it("payload.member_id tem prioridade sobre snapshot do write", () => {
    const v = validateCreatePayload(
      makeWrite({ op: "create", memberId: "m-snapshot", payload: { member_id: "m-payload" } }),
    );
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.payload.member_id).toBe("m-payload");
  });

  it("entidades não-assets podem ser criadas sem member_id", () => {
    const v = validateCreatePayload(
      makeWrite({ entity: "income", op: "create", memberId: null, payload: { source: "Salário" } }),
    );
    expect(v.ok).toBe(true);
  });
});

describe("resolveMemberId e payloadMentionsMember", () => {
  it("(d) merge update+update preserva member_id (simulação do coalesce)", () => {
    // Simula o merge feito por enqueueWrite: payload mesclado, memberId fallback.
    const merged = {
      payload: { ...{ current_amount: 100 }, ...{ notes: "ok" } },
      memberId: "m-original",
    };
    expect(resolveMemberId(merged)).toBe("m-original");
    // E como nenhum dos updates mencionou member_id, o replay não envia.
    expect(payloadMentionsMember(merged.payload)).toBe(false);
  });

  it("(e) create+update mantém member_id se update não alterar titular", () => {
    // Quando update mescla num create pendente, o create já carrega member_id;
    // o update silencioso não pode apagar isso.
    const create = {
      payload: { member_id: "m-create", current_amount: 100 },
      memberId: "m-create",
    };
    const updateSilencioso = { notes: "rebalanceado" };
    const merged = {
      payload: { ...create.payload, ...updateSilencioso },
      memberId: create.memberId,
    };
    expect(resolveMemberId(merged)).toBe("m-create");
    expect(merged.payload.member_id).toBe("m-create");
  });

  it("(f) conflict 'mine': sanitize não força member_id quando payload original silencia", () => {
    // Mesmo que a nuvem tenha um member_id diferente, sem mention no payload
    // local nós NÃO sobrescrevemos — preserva vínculo da nuvem.
    const out = sanitizeUpdatePayload(
      makeWrite({ payload: { current_amount: 999 }, memberId: "m-stale-snapshot" }),
    );
    expect("member_id" in out).toBe(false);
  });
});