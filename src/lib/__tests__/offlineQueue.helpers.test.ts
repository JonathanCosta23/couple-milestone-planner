/**
 * Hardening da offline queue: ownership precisa sobreviver ao enqueue/replay.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeUpdatePayload,
  validateCreatePayload,
  resolveMemberId,
  resolveOwnershipScope,
  payloadMentionsMember,
  payloadMentionsOwnership,
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
  it("update financeiro comum não envia member_id nem ownership_scope", () => {
    const out = sanitizeUpdatePayload(makeWrite({
      payload: { current_amount: 5000 }, memberId: "m-123",
    }));
    expect(out).toEqual({ current_amount: 5000 });
  });

  it("troca explícita preserva member_id e ownership_scope", () => {
    const out = sanitizeUpdatePayload(makeWrite({
      payload: {
        current_amount: 100,
        member_id: "m-new",
        ownership_scope: "individual",
      },
      memberId: "m-snapshot",
    }));
    expect(out.member_id).toBe("m-new");
    expect(out.ownership_scope).toBe("individual");
  });

  it("remove user_id e plan_id confiados pelo cliente", () => {
    const out = sanitizeUpdatePayload(makeWrite({
      payload: { user_id: "outro", plan_id: "outro", current_amount: 1 },
    }));
    expect(out).toEqual({ current_amount: 1 });
  });

  it("valor de scope inválido não é convertido silenciosamente", () => {
    const out = sanitizeUpdatePayload(makeWrite({
      payload: { ownership_scope: "couple", member_id: null },
    }));
    expect(out.ownership_scope).toBe("couple");
    expect(out.member_id).toBeNull();
  });
});

describe("validateCreatePayload — entidades financeiras", () => {
  for (const entity of ["asset", "income", "expense", "debt"] as const) {
    it(`${entity} bloqueia create sem member_id`, () => {
      const result = validateCreatePayload(makeWrite({
        entity, op: "create", memberId: null,
        payload: { ownership_scope: "individual" },
      }));
      expect(result.ok).toBe(false);
    });

    it(`${entity} bloqueia create sem ownership_scope explícito`, () => {
      const result = validateCreatePayload(makeWrite({
        entity, op: "create", memberId: "m-1", payload: {},
      }));
      expect(result.ok).toBe(false);
      if (result.ok === false) expect(result.reason).toMatch(/ownership/i);
    });

    it(`${entity} aceita create individual completo e não confia em user_id`, () => {
      const result = validateCreatePayload(makeWrite({
        entity,
        op: "create",
        memberId: "m-1",
        payload: {
          member_id: "m-1",
          ownership_scope: "individual",
          user_id: "forjado",
          amount: 100,
        },
      }));
      expect(result.ok).toBe(true);
      if (result.ok === true) {
        expect(result.payload.plan_id).toBe("plan-1");
        expect(result.payload.member_id).toBe("m-1");
        expect(result.payload.ownership_scope).toBe("individual");
        expect(result.payload).not.toHaveProperty("user_id");
      }
    });
  }

  it("bloqueia scope needs_review em replay normal", () => {
    const result = validateCreatePayload(makeWrite({
      entity: "expense",
      op: "create",
      memberId: null,
      payload: { ownership_scope: "needs_review", member_id: null },
    }));
    expect(result.ok).toBe(false);
  });

  it("entidade não financeira mantém user_id legado", () => {
    const result = validateCreatePayload(makeWrite({
      entity: "monthly_tracking",
      op: "create",
      payload: { month_key: "2026-08" },
    }));
    expect(result.ok).toBe(true);
    if (result.ok === true) expect(result.payload.user_id).toBe("user-1");
  });
});

describe("resolução de ownership na fila", () => {
  it("payload explícito tem prioridade sobre snapshot", () => {
    const write = makeWrite({
      payload: { member_id: "m-payload", ownership_scope: "individual" },
      memberId: "m-snapshot",
    });
    expect(resolveMemberId(write)).toBe("m-payload");
    expect(resolveOwnershipScope(write)).toBe("individual");
    expect(payloadMentionsMember(write.payload)).toBe(true);
    expect(payloadMentionsOwnership(write.payload)).toBe(true);
  });

  it("merge silencioso preserva os campos do create", () => {
    const create = {
      payload: { member_id: "m-create", ownership_scope: "individual", amount: 100 },
      memberId: "m-create",
    };
    const merged = {
      payload: { ...create.payload, notes: "ok" },
      memberId: create.memberId,
    };
    expect(resolveMemberId(merged)).toBe("m-create");
    expect(resolveOwnershipScope(merged)).toBe("individual");
  });
});
