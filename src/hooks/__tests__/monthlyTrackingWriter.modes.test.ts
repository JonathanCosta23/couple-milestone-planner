/**
 * Fase 2.D — Contrato de escrita de monthly_tracking + monthly_member_tracking.
 * Garante que o writer envia somente os membros corretos para a RPC
 * transacional, respeitando modo individual (apenas titular) e casal
 * (titular + parceiro), e que o blob `user_financial_data` NÃO é tocado.
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
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/services/auditService", () => ({
  trackWriterChange: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue({ ok: true }),
  logProductEvent: vi.fn().mockResolvedValue({ ok: true }),
}));

import { renderHook, act } from "@testing-library/react";
import { useMonthlyTrackingWriter } from "@/hooks/useMonthlyTrackingWriter";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("useMonthlyTrackingWriter — modos individual e casal", () => {
  it("modo individual: envia apenas o titular para a RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { tracking: { id: "t1", status: "partial" }, members: [] },
      error: null,
    });
    const { result } = renderHook(() => useMonthlyTrackingWriter());
    await act(async () => {
      await result.current.upsertMonth("plan-1", "2026-05", [
        { planMemberId: "primary", plannedSelic: 1000, plannedCDB: 0, actualSelic: 500, actualCDB: 0 },
      ]);
    });
    const args = rpcMock.mock.calls[0][1];
    expect(args.p_members).toHaveLength(1);
    expect(args.p_members[0].plan_member_id).toBe("primary");
    // Blob legado não pode ser tocado pelo writer.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("modo casal: envia titular e parceiro com totais separados", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { tracking: { id: "t2", status: "completed" }, members: [] },
      error: null,
    });
    const { result } = renderHook(() => useMonthlyTrackingWriter());
    await act(async () => {
      await result.current.upsertMonth("plan-1", "2026-06", [
        { planMemberId: "primary", plannedSelic: 800, plannedCDB: 200, actualSelic: 800, actualCDB: 200 },
        { planMemberId: "partner", plannedSelic: 600, plannedCDB: 0, actualSelic: 600, actualCDB: 0 },
      ]);
    });
    const args = rpcMock.mock.calls[0][1];
    expect(args.p_members).toHaveLength(2);
    expect(args.p_members.map((m: { plan_member_id: string }) => m.plan_member_id)).toEqual(["primary", "partner"]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("filtra membros sem planMemberId (parceiro removido em mês antigo)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { tracking: { id: "t3", status: "partial" }, members: [] },
      error: null,
    });
    const { result } = renderHook(() => useMonthlyTrackingWriter());
    await act(async () => {
      await result.current.upsertMonth("plan-1", "2026-07", [
        { planMemberId: "primary", plannedSelic: 500, plannedCDB: 0, actualSelic: 500, actualCDB: 0 },
        // Parceiro foi desativado depois — não temos planMemberId; deve ser descartado.
        { planMemberId: "", plannedSelic: 300, plannedCDB: 0, actualSelic: 0, actualCDB: 0 },
      ]);
    });
    const args = rpcMock.mock.calls[0][1];
    expect(args.p_members).toHaveLength(1);
    expect(args.p_members[0].plan_member_id).toBe("primary");
  });
});