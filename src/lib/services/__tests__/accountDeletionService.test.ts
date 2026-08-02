import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  invoke: vi.fn(),
  signOut: vi.fn(),
  clearAll: vi.fn(),
  clearProductLocalCache: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mocks.getSession, signOut: mocks.signOut },
    functions: { invoke: mocks.invoke },
  },
}));
vi.mock("@/lib/offlineQueue", () => ({ clearAll: mocks.clearAll }));
vi.mock("@/lib/services/localCacheOwner", () => ({
  clearProductLocalCache: mocks.clearProductLocalCache,
}));

import { AccountDeletionError, deleteAccountPermanently } from "@/lib/services/accountDeletionService";

describe("deleteAccountPermanently", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    mocks.invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.clearAll.mockResolvedValue(undefined);
  });

  it("exclui no servidor antes de limpar a conta local", async () => {
    await deleteAccountPermanently("user-1", "USER@EXAMPLE.COM");
    expect(mocks.invoke).toHaveBeenCalledWith("delete-account", {
      body: { email: "user@example.com" },
    });
    expect(mocks.clearProductLocalCache).toHaveBeenCalledWith("user-1");
    expect(mocks.clearAll).toHaveBeenCalledWith("user-1");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("não limpa dados locais quando o servidor rejeita", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error("failed") });
    await expect(
      deleteAccountPermanently("user-1", "user@example.com"),
    ).rejects.toMatchObject({ code: "delete_failed" });
    expect(mocks.clearProductLocalCache).not.toHaveBeenCalled();
    expect(mocks.clearAll).not.toHaveBeenCalled();
  });

  it("exige uma sessão autenticada", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(
      deleteAccountPermanently("user-1", "user@example.com"),
    ).rejects.toBeInstanceOf(AccountDeletionError);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
