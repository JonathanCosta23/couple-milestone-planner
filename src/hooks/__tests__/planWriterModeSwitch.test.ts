/**
 * usePlanWriter.setPlanMode — 4.b.1.1-A:
 *  - Contrato ModeChangeResult (sem PlanRow artificial).
 *  - Parsers estritos: null/ausente/tipos incorretos ⇒ invalid_rpc_payload.
 *  - No-ops confirmam via normalize_plan_mode_v1 antes de declarar sucesso.
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

// Evita chamadas reais ao auditService (que tentaria gravar em audit_log /
// product_events via supabase.from, fora do escopo deste teste de RPC).
vi.mock("@/lib/services/auditService", () => ({
  trackWriterChange: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue({ ok: true }),
  logProductEvent: vi.fn().mockResolvedValue({ ok: true }),
}));

import { renderHook, act } from "@testing-library/react";
import { usePlanWriter } from "@/hooks/usePlanWriter";
import type { ModeChangeResult } from "@/hooks/planWriter/modeChange";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("usePlanWriter.setPlanMode", () => {
  it("casal -> individual: chama apenas remove_plan_partner_v1", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "p1", removed_partner_id: "old", mode: "individual" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: "x" };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("remove_plan_partner_v1", { p_plan_id: "p1" });
    expect(fromMock).not.toHaveBeenCalled();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({
      outcome: "changed", planId: "p1", mode: "individual",
      partnerId: null, removedPartnerId: "old",
    });
  });

  it("individual -> casal com parceiro: chama add_plan_partner_v1", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { partner_id: "new", plan_id: "p1", mode: "casal" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: "x" };
    await act(async () => {
      res = await result.current.setPlanMode("p1", "casal", { name: "Bia", age: 30 });
    });
    expect(rpcMock).toHaveBeenCalledWith("add_plan_partner_v1", {
      p_plan_id: "p1", p_name: "Bia", p_age: 30,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({
      outcome: "changed", planId: "p1", mode: "casal",
      partnerId: "new", removedPartnerId: null,
    });
  });

  it("casal sem partner, plano já casal → noop confirmado por normalize", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { mode: "casal", primary_active: 1, partner_active: 1 },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: "x" };
    await act(async () => { res = await result.current.setPlanMode("p1", "casal"); });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ outcome: "noop", mode: "casal", planId: "p1" });
    expect(rpcMock).toHaveBeenCalledWith("normalize_plan_mode_v1", { p_plan_id: "p1" });
  });

  it("casal sem partner, plano é individual → partner_name_required", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { mode: "individual", primary_active: 1, partner_active: 0 },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "casal"); });
    expect(res.error).toBe("partner_name_required");
    expect(res.data).toBeNull();
  });

  it("casal sem partner, normalize inválido → propaga invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({ data: { mode: "casal" }, error: null });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "casal"); });
    expect(res.error).toBe("invalid_rpc_payload");
  });

  it("individual em plano já individual: normaliza e confirma sucesso quando mode='individual'", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: "partner_not_active" } })
      .mockResolvedValueOnce({ data: { mode: "individual", primary_active: 1, partner_active: 0 }, error: null });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: "x" };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ outcome: "noop", mode: "individual", planId: "p1" });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "normalize_plan_mode_v1", { p_plan_id: "p1" });
  });

  it("casal com parceiro já ativo: normaliza e confirma sucesso quando mode='casal'", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: "partner_already_active" } })
      .mockResolvedValueOnce({ data: { mode: "casal", primary_active: 1, partner_active: 1 }, error: null });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: "x" };
    await act(async () => {
      res = await result.current.setPlanMode("p1", "casal", { name: "Bia" });
    });
    expect(res.error).toBeNull();
    expect(res.data).toMatchObject({ outcome: "noop", mode: "casal", planId: "p1" });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "normalize_plan_mode_v1", { p_plan_id: "p1" });
  });

  it("individual: se normalize devolver mode divergente, retorna erro (nunca falso sucesso)", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: "partner_not_active" } })
      .mockResolvedValueOnce({ data: { mode: "casal", primary_active: 1, partner_active: 1 }, error: null });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.error).toBe("plan_members_inconsistent");
  });

  it("casal: se normalize devolver mode divergente, retorna erro (nunca falso sucesso)", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: "partner_already_active" } })
      .mockResolvedValueOnce({ data: { mode: "individual", primary_active: 1, partner_active: 0 }, error: null });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.setPlanMode("p1", "casal", { name: "Bia" });
    });
    expect(res.error).toBe("plan_members_inconsistent");
  });

  it("individual: payload null da RPC principal → invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.error).toBe("invalid_rpc_payload");
    expect(res.data).toBeNull();
  });

  it("casal: payload sem partner_id → invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "p1", mode: "casal" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.setPlanMode("p1", "casal", { name: "Bia" });
    });
    expect(res.error).toBe("invalid_rpc_payload");
  });

  it("casal: mode com valor inválido no payload → invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "p1", mode: "solo", partner_id: "x" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.setPlanMode("p1", "casal", { name: "Bia" });
    });
    expect(res.error).toBe("invalid_rpc_payload");
  });

  it("no-op cases nunca fabricam PlanRow — retornam somente ModeChangeResult", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: "partner_not_active" } })
      .mockResolvedValueOnce({ data: { mode: "individual", primary_active: 1, partner_active: 0 }, error: null });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.data).not.toHaveProperty("plan");
    expect(res.data).not.toHaveProperty("members");
  });

  it("individual: remove com removed_partner_id ausente → invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "p1", mode: "individual" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.error).toBe("invalid_rpc_payload");
  });

  it("individual: remove com removed_partner_id null → invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "p1", mode: "individual", removed_partner_id: null },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.error).toBe("invalid_rpc_payload");
  });

  it("individual: plan_id divergente na RPC → invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "OUTRO", mode: "individual", removed_partner_id: "old" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.error).toBe("invalid_rpc_payload");
  });

  it("casal: plan_id divergente na RPC → invalid_rpc_payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "OUTRO", mode: "casal", partner_id: "new" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.setPlanMode("p1", "casal", { name: "Bia" });
    });
    expect(res.error).toBe("invalid_rpc_payload");
  });

  it("individual: payload divergente mas normalize confirma → mode confirmado e outcome=changed", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: { plan_id: "p1", mode: "casal", removed_partner_id: "old" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { mode: "individual", primary_active: 1, partner_active: 0 },
        error: null,
      });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: ModeChangeResult | null; error: string | null } = { data: null, error: "x" };
    await act(async () => { res = await result.current.setPlanMode("p1", "individual"); });
    expect(res.error).toBeNull();
    expect(res.data?.outcome).toBe("changed");
    expect(res.data?.mode).toBe("individual");
    expect(res.data?.removedPartnerId).toBe("old");
  });

  it("auditoria usa exatamente o resultado final (mode/outcome confirmados)", async () => {
    // (ver teste simétrico de adição logo acima)
    const audit = await import("@/lib/services/auditService");
    (audit.trackWriterChange as unknown as { mockClear: () => void; mock: { calls: unknown[][] } }).mockClear();
    rpcMock
      .mockResolvedValueOnce({
        data: { plan_id: "p1", mode: "casal", removed_partner_id: "old" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { mode: "individual", primary_active: 1, partner_active: 0 },
        error: null,
      });
    const { result } = renderHook(() => usePlanWriter());
    await act(async () => { await result.current.setPlanMode("p1", "individual"); });
    const call = (audit.trackWriterChange as unknown as { mock: { calls: Array<[Record<string, unknown>]> } }).mock.calls[0][0] as { eventProperties: unknown; newValue: unknown };
    expect(call.eventProperties).toEqual({ mode: "individual", outcome: "changed" });
    expect(call.newValue).toEqual({ mode: "individual" });
  });
});

describe("friendlyError — invalid_rpc_payload", () => {
  it("não expõe payload bruto", async () => {
    const { toFriendlyError } = await import("@/lib/errors/friendlyError");
    const msg = toFriendlyError("invalid_rpc_payload");
    expect(msg).toMatch(/confirmar a resposta do servidor/i);
    expect(msg).not.toMatch(/payload|rpc|json|null|undefined/i);
  });
});