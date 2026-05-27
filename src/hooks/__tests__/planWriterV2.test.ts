/**
 * Cobertura da RPC v2 `upsert_plan_with_members_v2` no usePlanWriter:
 *   a) chamadas usam plan_id explícito quando disponível;
 *   b) erro de "modo casal sem parceiro" é propagado claramente;
 *   c) modo individual delega à RPC com p_partner_name null (desativação no banco);
 *   d) chamada via setPlanMode em plano X nunca recebe outro planId;
 *   e) fallback para a RPC antiga só ocorre se a v2 não existe (PGRST202).
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
vi.mock("@/lib/services/auditService", () => ({
  trackWriterChange: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue({ ok: true }),
  logProductEvent: vi.fn().mockResolvedValue({ ok: true }),
}));

import { renderHook, act } from "@testing-library/react";
import { usePlanWriter } from "@/hooks/usePlanWriter";

function chainable(final: unknown) {
  const api: Record<string, unknown> = {};
  const passthrough = () => api;
  for (const m of ["select", "eq", "order", "limit", "update", "insert", "delete"]) {
    api[m] = vi.fn(passthrough);
  }
  api.maybeSingle = vi.fn().mockResolvedValue(final);
  api.single = vi.fn().mockResolvedValue(final);
  api.then = (resolve: (v: unknown) => void) => resolve(final);
  return api;
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("upsert_plan_with_members_v2 — usePlanWriter", () => {
  it("setPlanMode envia p_plan_id explícito para o plano alvo", async () => {
    fromMock.mockImplementationOnce(() =>
      chainable({ data: { name: "Ana", age: 30 }, error: null }),
    );
    rpcMock.mockResolvedValueOnce({
      data: {
        plan: { id: "plan-A", mode: "individual" },
        members: [{ id: "m1", is_primary: true, is_active: true }],
      },
      error: null,
    });

    const { result } = renderHook(() => usePlanWriter());
    await act(async () => {
      await result.current.setPlanMode("plan-A", "individual");
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_plan_with_members_v2",
      expect.objectContaining({ p_plan_id: "plan-A", p_mode: "individual" }),
    );
    // Não pode vazar outro planId para a mesma chamada.
    const callArgs = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.p_plan_id).toBe("plan-A");
  });

  it("propaga erro da RPC quando casal é solicitado sem parceiro", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "upsert_plan_with_members_v2: modo casal exige nome do parceiro." },
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { error: string | null } = { error: null };
    await act(async () => {
      res = await result.current.createPlanFromWizard({
        mode: "casal",
        primaryName: "Ana",
        partnerName: null,
      });
    });
    expect(res.error).toMatch(/parceiro/i);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("modo individual envia p_partner_name null (desativação no banco)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan: { id: "p1", mode: "individual" }, members: [] },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    await act(async () => {
      await result.current.createPlanFromWizard({
        mode: "individual",
        primaryName: "Ana",
      });
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_plan_with_members_v2",
      expect.objectContaining({ p_mode: "individual", p_partner_name: null }),
    );
  });

  it("cai no fallback da RPC antiga apenas quando v2 não existe (PGRST202)", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: null,
        error: { message: "function public.upsert_plan_with_members_v2 does not exist (PGRST202)" },
      })
      .mockResolvedValueOnce({
        data: { plan: { id: "p1", mode: "individual" }, members: [] },
        error: null,
      });

    const { result } = renderHook(() => usePlanWriter());
    await act(async () => {
      await result.current.createPlanFromWizard({
        mode: "individual",
        primaryName: "Ana",
      });
    });
    expect(rpcMock).toHaveBeenNthCalledWith(
      1,
      "upsert_plan_with_members_v2",
      expect.any(Object),
    );
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      "upsert_plan_with_members",
      expect.objectContaining({ p_mode: "individual" }),
    );
  });
});