/**
 * resetService — garante que reset destrutivo limpa RPC, fila offline e
 * localStorage do produto (atual + legado + milestones celebrados).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

const clearAllMock = vi.fn().mockResolvedValue(undefined);
const listDeadLettersMock = vi.fn().mockResolvedValue([]);
const removeWriteMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/offlineQueue", () => ({
  clearAll: (...a: unknown[]) => clearAllMock(...a),
  listDeadLetters: (...a: unknown[]) => listDeadLettersMock(...a),
  removeWrite: (...a: unknown[]) => removeWriteMock(...a),
}));

import { resetUserPlan } from "@/lib/services/resetService";

beforeEach(() => {
  rpcMock.mockReset();
  clearAllMock.mockClear();
  listDeadLettersMock.mockClear();
  removeWriteMock.mockClear();
  localStorage.clear();
});

describe("resetService.resetUserPlan", () => {
  it("chama RPC reset_user_plan_data, limpa fila e remove chaves do produto", async () => {
    rpcMock.mockResolvedValueOnce({ data: { ok: true }, error: null });
    listDeadLettersMock.mockResolvedValueOnce([{ id: "w1" }]);

    // Popula localStorage com chaves do produto (atuais, legadas e milestones
    // celebrados por usuário/plano) + uma chave de outro sistema que NÃO pode
    // ser apagada.
    localStorage.setItem("plano-do-milhao-v6", "{}");
    localStorage.setItem("plano-do-milhao-app-v7", "{}");
    localStorage.setItem("plano-do-milhao-app-v7-prev", "{}");
    localStorage.setItem("plano-celebrated-milestones::user-1::plan-1", "[1000000]");
    localStorage.setItem("plano-celebrated-milestones", "[1000000]");
    localStorage.setItem("outra-app-que-nao-eh-nossa", "preserve-me");

    const res = await resetUserPlan("user-1");

    expect(rpcMock).toHaveBeenCalledWith("reset_user_plan_data");
    expect(res.ok).toBe(true);
    expect(res.cleared.rpc).toBe(true);
    expect(res.cleared.offlineQueue).toBe(true);

    // Fila offline: pendentes + dead-letters tratados.
    expect(clearAllMock).toHaveBeenCalledWith("user-1");
    expect(removeWriteMock).toHaveBeenCalledWith("w1");

    // localStorage: chaves do produto sumiram, alheias preservadas.
    expect(localStorage.getItem("plano-do-milhao-v6")).toBeNull();
    expect(localStorage.getItem("plano-do-milhao-app-v7")).toBeNull();
    expect(localStorage.getItem("plano-do-milhao-app-v7-prev")).toBeNull();
    expect(localStorage.getItem("plano-celebrated-milestones")).toBeNull();
    expect(localStorage.getItem("plano-celebrated-milestones::user-1::plan-1")).toBeNull();
    expect(localStorage.getItem("outra-app-que-nao-eh-nossa")).toBe("preserve-me");

    expect(res.cleared.localStorageKeys).toEqual(
      expect.arrayContaining([
        "plano-do-milhao-v6",
        "plano-do-milhao-app-v7",
        "plano-celebrated-milestones::user-1::plan-1",
      ]),
    );
  });

  it("é idempotente: rodar duas vezes não recria dados nem quebra", async () => {
    rpcMock.mockResolvedValue({ data: { ok: true }, error: null });
    const r1 = await resetUserPlan("user-1");
    const r2 = await resetUserPlan("user-1");
    expect(r1.ok && r2.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledTimes(2);
    // Sem chaves para limpar na segunda passada (já vazio).
    expect(r2.cleared.localStorageKeys).toEqual([]);
  });

  it("falha de RPC não impede limpeza de localStorage e fila", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    localStorage.setItem("plano-do-milhao-v6", "{}");

    const res = await resetUserPlan("user-1");

    expect(res.ok).toBe(false);
    expect(res.error).toBe("boom");
    expect(res.cleared.rpc).toBe(false);
    expect(res.cleared.offlineQueue).toBe(true);
    expect(localStorage.getItem("plano-do-milhao-v6")).toBeNull();
  });
});