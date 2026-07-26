import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// Mock supabase client com um namespace `auth.oauth` configurável por teste.
const listGrants = vi.fn();
const revokeGrant = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      oauth: {
        listGrants: (...args: unknown[]) => listGrants(...args),
        revokeGrant: (...args: unknown[]) => revokeGrant(...args),
      },
    },
  },
}));

import { useMcpConnections } from "@/hooks/useMcpConnections";

beforeEach(() => {
  listGrants.mockReset();
  revokeGrant.mockReset();
});

describe("useMcpConnections", () => {
  it("retorna 'unauthenticated' quando userId é nulo", async () => {
    const { result } = renderHook(() => useMcpConnections(null));
    await waitFor(() => expect(result.current.state).toBe("unauthenticated"));
    expect(result.current.errorCode).toBe("unauthenticated");
    expect(listGrants).not.toHaveBeenCalled();
  });

  it("mapeia grants válidos e ignora malformados sem quebrar", async () => {
    listGrants.mockResolvedValue({
      data: [
        {
          client: { id: "c1", name: "ChatGPT" },
          scopes: ["openid", "authenticated"],
          granted_at: "2025-01-15T00:00:00.000Z",
        },
        { client: { id: "c2" } }, // sem name → malformado
        null,
      ],
      error: null,
    });
    const { result } = renderHook(() => useMcpConnections("user-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.grants).toHaveLength(1);
    expect(result.current.grants[0].name).toBe("ChatGPT");
    expect(result.current.grants[0].scopes).toEqual(["openid", "authenticated"]);
  });

  it("nunca vaza mensagem crua do provedor em errorCode", async () => {
    listGrants.mockResolvedValue({
      data: null,
      error: { message: "PGRST999: raw internal detail with token abc123" },
    });
    const { result } = renderHook(() => useMcpConnections("user-1"));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("grants_load_failed");
    // errorCode é enum fechado — impossível conter mensagem crua.
  });

  it("marca 'unavailable' quando o adapter OAuth não existe", async () => {
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: { auth: {} },
    }));
    vi.resetModules();
    const { useMcpConnections: hook } = await import("@/hooks/useMcpConnections");
    const { result } = renderHook(() => hook("user-1"));
    await waitFor(() => expect(result.current.state).toBe("unavailable"));
    expect(result.current.errorCode).toBe("oauth_unavailable");
    vi.doUnmock("@/integrations/supabase/client");
    vi.resetModules();
  });

  it("detecta shape inválido no response", async () => {
    listGrants.mockResolvedValue({ data: "not-an-array", error: null });
    const { result } = renderHook(() => useMcpConnections("user-1"));
    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.errorCode).toBe("invalid_grant_response");
  });

  it("revoke não remove otimista; devolve código de erro seguro em falha", async () => {
    listGrants.mockResolvedValue({
      data: [
        {
          client: { id: "c1", name: "ChatGPT" },
          scopes: [],
          granted_at: "2025-01-15T00:00:00.000Z",
        },
      ],
      error: null,
    });
    revokeGrant.mockResolvedValue({ error: { message: "boom internal" } });
    const { result } = renderHook(() => useMcpConnections("user-1"));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    let outcome: { error: string | null } = { error: null };
    await act(async () => {
      outcome = await result.current.revoke("c1");
    });
    expect(outcome.error).toBe("grant_revoke_failed");
    // Continua na lista até um reload confirmar a mudança do servidor.
    expect(result.current.grants).toHaveLength(1);
  });
});