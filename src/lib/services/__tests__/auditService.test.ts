import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({ insert: insertMock })),
  },
}));

import { logAudit, logProductEvent, trackWriterChange } from "@/lib/services/auditService";

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
});

describe("auditService", () => {
  it("logProductEvent envia payload mínimo com user/event", async () => {
    const r = await logProductEvent({ userId: "u1", event: "plan_created", properties: { mode: "casal" } });
    expect(r.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "u1", event_name: "plan_created", properties: { mode: "casal" },
    }));
  });

  it("logProductEvent retorna {ok:false} sem userId, sem chamar banco", async () => {
    const r = await logProductEvent({ userId: "", event: "plan_created" });
    expect(r.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("logAudit serializa old/new e respeita critical em falha", async () => {
    insertMock.mockResolvedValueOnce({ error: { message: "boom" } });
    const r = await logAudit({
      userId: "u1", entity: "asset", entityId: "a1", action: "delete",
      oldValue: { v: 1 }, critical: true,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("boom");
  });

  it("trackWriterChange dispara audit + event em paralelo", async () => {
    await trackWriterChange({
      userId: "u1", planId: "p1", entity: "asset", entityId: "a1",
      action: "create", newValue: { x: 1 }, event: "asset_created",
    });
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it("trackWriterChange sem event só grava audit_log", async () => {
    await trackWriterChange({
      userId: "u1", entity: "plan", entityId: "p1", action: "update",
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
