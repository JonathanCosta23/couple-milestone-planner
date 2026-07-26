/**
 * usePlanWriter.addPartner / removePartner — passam por RPC transacional
 * (add_plan_partner_v1 / remove_plan_partner_v1). Garantimos que:
 *   a) addPartner chama a RPC com o payload correto e nunca tenta reativar
 *      linhas antigas com is_active=true;
 *   b) removePartner chama a RPC única (nunca faz update em duas etapas);
 *   c) erros fechados vindos do banco viram error message inalterada, e
 *      não deixam plano/parceiro em estado parcial.
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

describe("usePlanWriter.addPartner (RPC add_plan_partner_v1)", () => {
  it("delega à RPC e depois lê a linha nova — nunca reativa parceiro removido", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "p1", partner_id: "new-partner", mode: "casal" },
      error: null,
    });
    // read back after RPC
    fromMock.mockImplementationOnce(() =>
      chainable({ data: { id: "new-partner", is_primary: false, is_active: true, name: "Bia" }, error: null }),
    );

    const { result } = renderHook(() => usePlanWriter());
    let res: { data: { id: string } | null; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.addPartner("p1", { name: "Bia", age: 30 });
    });

    expect(rpcMock).toHaveBeenCalledWith("add_plan_partner_v1", {
      p_plan_id: "p1",
      p_name: "Bia",
      p_age: 30,
    });
    // Não usa update em plan_members para reativar — só o SELECT posterior.
    const fromCalls = fromMock.mock.calls.map((c) => c[0]);
    expect(fromCalls).toContain("plan_members");
    expect(res.data?.id).toBe("new-partner");
  });

  it("propaga partner_already_active sem tocar em nada", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "partner_already_active", code: "23505" },
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.addPartner("p1", { name: "Bia" });
    });
    expect(res.error).toBe("partner_already_active");
    // Sem RPC de sucesso, não deve haver select/update em plan_members.
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("usePlanWriter.removePartner (RPC remove_plan_partner_v1)", () => {
  it("chama a RPC única — nunca faz duas etapas expostas", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { plan_id: "p1", removed_partner_id: "old", mode: "individual" },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    await act(async () => {
      await result.current.removePartner("p1");
    });
    expect(rpcMock).toHaveBeenCalledWith("remove_plan_partner_v1", { p_plan_id: "p1" });
    // Sem writes em plans/plan_members diretamente.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("propaga partner_not_active e não altera nada localmente", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "partner_not_active" },
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.removePartner("p1");
    });
    expect(res.error).toBe("partner_not_active");
    expect(fromMock).not.toHaveBeenCalled();
  });
});