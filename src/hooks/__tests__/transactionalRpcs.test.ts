/**
 * Garante que os hooks críticos chamam as RPCs transacionais corretas e
 * caem em fallback apenas se a RPC indicar "função inexistente".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

// auditService é fire-and-forget e tenta gravar em audit_log/product_events.
// Nestes testes focamos só nas RPCs transacionais — mockamos o serviço
// para evitar chamadas extras a supabase.from() e warnings de undefined.
vi.mock("@/lib/services/auditService", () => ({
  trackWriterChange: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue({ ok: true }),
  logProductEvent: vi.fn().mockResolvedValue({ ok: true }),
}));

import { renderHook, act } from "@testing-library/react";
import { usePlanWriter } from "@/hooks/usePlanWriter";
import { useMonthlyTrackingWriter } from "@/hooks/useMonthlyTrackingWriter";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("usePlanWriter.createPlanFromWizard", () => {
  it("chama RPC upsert_plan_with_members_v3 com modo individual", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan: { id: "p1", mode: "individual" }, members: [] },
      error: null,
    });

    const { result } = renderHook(() => usePlanWriter());
    let res: unknown;
    await act(async () => {
      res = await result.current.createPlanFromWizard({
        mode: "individual",
        primaryName: "Ana",
      });
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_plan_with_members_v3",
      expect.objectContaining({ p_mode: "individual", p_primary_name: "Ana", p_plan_id: null }),
    );
    expect((res as { data: { plan: { id: string } } }).data.plan.id).toBe("p1");
  });

  it("propaga erro real da RPC sem cair em fallback", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.createPlanFromWizard({
        mode: "casal",
        primaryName: "Ana",
        partnerName: "Bia",
      });
    });
    expect(res.error).toBe("permission denied");
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("useMonthlyTrackingWriter.upsertMonth", () => {
  it("envia members no formato esperado pela RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { tracking: { id: "t1", plan_id: "p1", month_key: "2026-01" }, members: [] },
      error: null,
    });
    const { result } = renderHook(() => useMonthlyTrackingWriter());
    let res: { data: { id: string } | null } = { data: null };
    await act(async () => {
      res = await result.current.upsertMonth("p1", "2026-01", [
        { planMemberId: "m1", plannedSelic: 100, plannedCDB: 50, actualSelic: 80, actualCDB: 20 },
      ]);
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_month_with_members",
      expect.objectContaining({
        p_plan_id: "p1",
        p_month_key: "2026-01",
        p_members: [
          expect.objectContaining({ plan_member_id: "m1", planned_selic: 100, actual_cdb: 20 }),
        ],
      }),
    );
    expect(res.data?.id).toBe("t1");
    // RPC path não pode cair no fallback de monthly_tracking.
    expect(fromMock).not.toHaveBeenCalled();
  });
});