import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const invoke = vi.fn();
const signOut = vi.fn();
const clearAll = vi.fn();
const clearProductLocalCache = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, signOut }, functions: { invoke } },
}));
vi.mock("@/lib/offlineQueue", () => ({ clearAll }));
vi.mock("@/lib/services/localCacheOwner", () => ({ clearProductLocalCache }));

import { AccountDeletionError, deleteAccountPermanently } from "@/lib/services/accountDeletionService";

describe("deleteAccountPermanently", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } }, error: null });
    invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    signOut.mockResolvedValue({ error: null });
    clearAll.mockResolvedValue(undefined);
  });

  it("exclui no servidor antes de limpar a conta local", async () => {
    await deleteAccountPermanently("user-1", "USER@EXAMPLE.COM");
    expect(invoke).toHaveBeenCalledWith("delete-account", { body: { email: "user@example.com" } });
    expect(clearProductLocalCache).toHaveBeenCalledWith("user-1");
    expect(clearAll).toHaveBeenCalledWith("user-1");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("não limpa dados locais quando o servidor rejeita", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("failed") });
    await expect(deleteAccountPermanently("user-1", "user@example.com")).rejects.toMatchObject({ code: "delete_failed" });
    expect(clearProductLocalCache).not.toHaveBeenCalled();
    expect(clearAll).not.toHaveBeenCalled();
  });

  it("exige uma sessão autenticada", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(deleteAccountPermanently("user-1", "user@example.com")).rejects.toBeInstanceOf(AccountDeletionError);
    expect(invoke).not.toHaveBeenCalled();
  });
});
