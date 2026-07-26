/**
 * usePlanWriter.updateMember — 4.a.3: passa exclusivamente pela RPC
 * `update_plan_member_profile_v1`. Nenhum UPDATE direto em `plan_members`.
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

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("usePlanWriter.updateMember (RPC only)", () => {
  it("chama update_plan_member_profile_v1 e não usa from('plan_members').update", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { id: "m1", name: "Ana", age: 33, avatar_color: null },
      error: null,
    });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: { id?: string } | null; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.updateMember("m1", { name: "Ana", age: 33 });
    });
    expect(rpcMock).toHaveBeenCalledWith("update_plan_member_profile_v1", {
      p_member_id: "m1",
      p_name: "Ana",
      p_age: 33,
      p_avatar_color: null,
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(res.error).toBeNull();
    expect(res.data?.id).toBe("m1");
  });

  it("falha da RPC não altera estado — retorna erro fechado", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "member_not_active" } });
    const { result } = renderHook(() => usePlanWriter());
    let res: { data: unknown; error: string | null } = { data: null, error: null };
    await act(async () => {
      res = await result.current.updateMember("m1", { name: "Ana" });
    });
    expect(res.error).toBe("member_not_active");
    expect(res.data).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
