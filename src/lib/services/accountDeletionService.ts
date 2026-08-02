import { supabase } from "@/integrations/supabase/client";
import { clearAll } from "@/lib/offlineQueue";
import { clearProductLocalCache } from "@/lib/services/localCacheOwner";

export type AccountDeletionErrorCode =
  | "auth_required"
  | "email_mismatch"
  | "delete_failed";

export class AccountDeletionError extends Error {
  constructor(public readonly code: AccountDeletionErrorCode) {
    super(code);
    this.name = "AccountDeletionError";
  }
}

export async function deleteAccountPermanently(userId: string, email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!userId || !normalizedEmail) throw new AccountDeletionError("auth_required");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new AccountDeletionError("auth_required");

  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { email: normalizedEmail },
  });

  if (error) throw new AccountDeletionError("delete_failed");
  if (!data || data.deleted !== true) {
    const code = data?.error === "email_mismatch" ? "email_mismatch" : "delete_failed";
    throw new AccountDeletionError(code);
  }

  clearProductLocalCache(userId);
  await clearAll(userId);

  // O usuário já foi removido no servidor. A limpeza local não pode transformar
  // uma exclusão confirmada em falso erro de interface.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // sessão local inválida após exclusão é o estado esperado
  }
}

export function accountDeletionMessage(error: unknown): string {
  if (error instanceof AccountDeletionError) {
    if (error.code === "auth_required") return "Sua sessão expirou. Entre novamente antes de excluir a conta.";
    if (error.code === "email_mismatch") return "O e-mail informado não corresponde à conta autenticada.";
  }
  return "Não foi possível excluir a conta. Nenhuma nova tentativa será feita automaticamente.";
}
