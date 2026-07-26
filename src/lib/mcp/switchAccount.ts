/**
 * switchAccount — Fluxo canônico de "Sair e conectar outra conta" da Central MCP.
 *
 * É reutilizado por `/connect` e pelo bloco "Integrações" dentro do
 * SettingsHub. O comportamento é idêntico nos dois pontos de entrada para
 * evitar divergência silenciosa: limpar a fila offline do usuário atual,
 * apagar apenas as chaves MCP locais conhecidas, executar `signOut` e
 * navegar para `/login?redirect=%2Fconnect` — para que o usuário volte à
 * Central MCP depois de autenticar com a nova conta.
 *
 * Este helper NÃO é o logout genérico do app. O logout genérico apenas
 * encerra a sessão do navegador; o fluxo abaixo é o único que também
 * limpa artefatos MCP locais e roteia de volta para a Central.
 */

import { logger } from "@/lib/logger";

/** Chaves locais criadas ao autorizar via MCP. Removidas de forma explícita. */
export const MCP_LOCAL_KEYS: readonly string[] = [
  "sb-mcp-authorization",
  "sb-mcp-authorization-id",
  "mcp:last-authorization",
  "mcp:last-client",
] as const;

/** Destino usado após o novo login para reabrir a Central MCP. */
export const MCP_SWITCH_ACCOUNT_REDIRECT = "/login?redirect=%2Fconnect" as const;

export interface PerformMcpSwitchAccountOptions {
  userId: string | null | undefined;
  signOut: () => Promise<unknown> | unknown;
  navigate: (to: string) => void;
}

/**
 * Executa o fluxo completo de troca de conta MCP.
 *
 * Ordem determinística:
 *  1. Drena a fila offline do usuário atual (best-effort).
 *  2. Remove somente as chaves MCP locais conhecidas.
 *  3. Executa `signOut`.
 *  4. Navega para `/login?redirect=%2Fconnect`.
 */
export async function performMcpSwitchAccount(
  options: PerformMcpSwitchAccountOptions,
): Promise<void> {
  const { userId, signOut, navigate } = options;
  if (userId) {
    try {
      const { clearAll } = await import("@/lib/offlineQueue");
      await clearAll(userId);
    } catch (err) {
      logger.warn("mcp.switchAccount.offlineQueue.clear.fail", { userId }, err);
    }
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      for (const key of MCP_LOCAL_KEYS) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (err) {
    logger.warn("mcp.switchAccount.local_clear.fail", {}, err);
  }
  try {
    await signOut();
  } catch (err) {
    logger.warn("mcp.switchAccount.signOut.fail", {}, err);
  }
  navigate(MCP_SWITCH_ACCOUNT_REDIRECT);
}