/**
 * usePlanWriter.setPlanMode — garante que alternar entre individual e casal
 * delega à RPC transacional, preservando o titular e desativando o parceiro
 * sem apagar histórico (a desativação é responsabilidade da RPC no banco).
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

/** Constrói um mock "chainable" que sempre devolve `final` no .maybeSingle()/.single(). */
function chainable(final: unknown) {
  const api: Record<string, unknown> = {};
  const passthrough = () => api;
  for (const m of ["select", "eq", "order", "limit", "update", "insert", "delete"]) {
    api[m] = vi.fn(passthrough);
  }
  api.maybeSingle = vi.fn().mockResolvedValue(final);
  api.single = vi.fn().mockResolvedValue(final);
  // Quando o writer usar await direto sem .single, retorna o final.
  api.then = (resolve: (v: unknown) => void) => resolve(final);
  return api;
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("usePlanWriter.setPlanMode (RPC)", () => {
  it("casal -> individual: chama RPC com modo individual e sem parceiro", async () => {
    // 1ª chamada from(): busca primary para reaproveitar nome/idade.
    fromMock.mockImplementationOnce(() =>
      chainable({ data: { name: "Ana", age: 33 }, error: null }),
    );
    // RPC retorna plano com apenas o titular ativo.
    rpcMock.mockResolvedValueOnce({
      data: {
        plan: { id: "p1", mode: "individual" },
        members: [{ id: "m-primary", is_primary: true, is_active: true, name: "Ana" }],
      },
      error: null,
    });

    const { result } = renderHook(() => usePlanWriter());
    let res: { data: { plan: { mode: string }; members: unknown[] } | null } = { data: null };
    await act(async () => {
      res = await result.current.setPlanMode("p1", "individual");
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_plan_with_members",
      expect.objectContaining({
        p_mode: "individual",
        p_primary_name: "Ana",
        p_partner_name: null,
      }),
    );
    expect(res.data?.plan.mode).toBe("individual");
    // Parceiro não aparece nos membros ativos retornados.
    expect(res.data?.members.length).toBe(1);
  });

  it("individual -> casal: envia parceiro novo para a RPC", async () => {
    fromMock.mockImplementationOnce(() =>
      chainable({ data: { name: "Ana", age: 33 }, error: null }),
    );
    rpcMock.mockResolvedValueOnce({
      data: {
        plan: { id: "p1", mode: "casal" },
        members: [
          { id: "m-primary", is_primary: true, is_active: true, name: "Ana" },
          { id: "m-partner", is_primary: false, is_active: true, name: "Bia" },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => usePlanWriter());
    await act(async () => {
      await result.current.setPlanMode("p1", "casal", { name: "Bia", age: 30 });
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_plan_with_members",
      expect.objectContaining({
        p_mode: "casal",
        p_primary_name: "Ana",
        p_partner_name: "Bia",
        p_partner_age: 30,
      }),
    );
  });
});