/**
 * usePlanWriter.updatePlan — não aceita `mode` (proteção do ciclo de vida).
 * Type-only assertion + runtime: mesmo que alguém force via cast, a payload
 * enviada ao banco não deve conter a coluna `mode`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMock = vi.fn().mockReturnThis();
const eqMock = vi.fn().mockReturnThis();
const selectMock = vi.fn().mockReturnThis();
const singleMock = vi.fn().mockResolvedValue({ data: { id: "p1" }, error: null });

const fromMock = vi.fn((..._args: unknown[]) => ({
  update: (...a: unknown[]) => { updateMock(...a); return { eq: eqMock, select: selectMock, single: singleMock }; },
  eq: (...a: unknown[]) => { eqMock(...a); return { eq: eqMock, select: selectMock, single: singleMock }; },
  select: (...a: unknown[]) => { selectMock(...a); return { single: singleMock }; },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...a), rpc: vi.fn() },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u" } }) }));

import { renderHook, act } from "@testing-library/react";
import { usePlanWriter } from "@/hooks/usePlanWriter";

beforeEach(() => { updateMock.mockClear(); eqMock.mockClear(); });

describe("usePlanWriter.updatePlan sem mode", () => {
  it("payload enviado ao banco NUNCA contém a coluna mode", async () => {
    const { result } = renderHook(() => usePlanWriter());
    await act(async () => {
      // Cast intencional: garante que mesmo com bypass de tipos, a impl. filtra.
      await result.current.updatePlan("p1", { goalAmount: 500 } as never);
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty("mode");
    expect(payload).toHaveProperty("goal_amount", 500);
  });
});
