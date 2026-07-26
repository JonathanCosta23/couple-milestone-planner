import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * useMcpConnections — lista e revoga grants OAuth 2.1 do próprio usuário.
 *
 * Contrato de erro: NENHUMA mensagem crua do provedor OAuth chega à UI.
 * Apenas códigos seguros e curtos são retornados; erros técnicos ficam
 * confinados ao `logger` para observabilidade interna.
 *
 * Códigos:
 *  - `oauth_unavailable`      SDK/servidor OAuth indisponível
 *  - `unauthenticated`        usuário deslogado
 *  - `grants_load_failed`     falha ao listar
 *  - `grant_revoke_failed`    falha ao revogar
 *  - `invalid_grant_response` resposta malformada do servidor
 */

export type McpErrorCode =
  | "oauth_unavailable"
  | "unauthenticated"
  | "grants_load_failed"
  | "grant_revoke_failed"
  | "invalid_grant_response";

export type McpConnectionsState =
  | "loading"
  | "unavailable"
  | "unauthenticated"
  | "ready"
  | "error";

export interface McpGrantSummary {
  /** Identificador interno usado apenas para revogar; nunca exibir na UI. */
  clientId: string;
  name: string;
  scopes: string[];
  /** ISO date string ou string vazia quando a data não pôde ser validada. */
  grantedAt: string;
}

/**
 * Contrato mínimo esperado do namespace `supabase.auth.oauth` (beta na
 * versão instalada do @supabase/supabase-js — os tipos ainda não são
 * exportados oficialmente). Mantemos o adapter isolado neste arquivo e
 * validamos toda resposta em runtime — nenhum `any` vaza para fora.
 */
interface OAuthAdapter {
  listGrants: () => Promise<{ data?: unknown; error?: unknown }>;
  revokeGrant: (options: { clientId: string }) => Promise<{ error?: unknown }>;
}

function getOAuthAdapter(): OAuthAdapter | null {
  const auth = supabase.auth as unknown as { oauth?: unknown };
  const candidate = auth.oauth;
  if (!candidate || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  if (typeof c.listGrants !== "function" || typeof c.revokeGrant !== "function") {
    return null;
  }
  return candidate as OAuthAdapter;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

/**
 * Valida e mapeia um único item de grant recebido do servidor. Retorna
 * `null` para itens malformados — o chamador loga e ignora.
 */
function mapGrant(raw: unknown): McpGrantSummary | null {
  if (!isRecord(raw)) return null;
  const client = raw.client;
  if (!isRecord(client)) return null;
  const id = typeof client.id === "string" ? client.id.trim() : "";
  const name = typeof client.name === "string" ? client.name.trim() : "";
  if (!id || !name) return null;
  const scopesRaw = raw.scopes;
  const scopes = Array.isArray(scopesRaw)
    ? scopesRaw.filter((s): s is string => typeof s === "string")
    : [];
  return {
    clientId: id,
    name,
    scopes,
    grantedAt: normalizeIsoDate(raw.granted_at),
  };
}

export function useMcpConnections(userId: string | null | undefined) {
  const [state, setState] = useState<McpConnectionsState>("loading");
  const [grants, setGrants] = useState<McpGrantSummary[]>([]);
  const [errorCode, setErrorCode] = useState<McpErrorCode | null>(null);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (!userId) {
      setGrants([]);
      setErrorCode("unauthenticated");
      setState("unauthenticated");
      return;
    }
    const oauth = getOAuthAdapter();
    if (!oauth) {
      setErrorCode("oauth_unavailable");
      setState("unavailable");
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setState("loading");
    setErrorCode(null);
    try {
      const response = await oauth.listGrants();
      if (response?.error) {
        logger.warn("mcp.grants.list_failed", { userId }, response.error);
        setErrorCode("grants_load_failed");
        setState("error");
        return;
      }
      const data = response?.data;
      if (data !== null && data !== undefined && !Array.isArray(data)) {
        logger.warn("mcp.grants.list_invalid_shape", { userId });
        setErrorCode("invalid_grant_response");
        setState("error");
        return;
      }
      const items = Array.isArray(data) ? data : [];
      const mapped: McpGrantSummary[] = [];
      let malformed = 0;
      for (const item of items) {
        const grant = mapGrant(item);
        if (grant) mapped.push(grant);
        else malformed += 1;
      }
      if (items.length > 0 && mapped.length === 0) {
        logger.warn("mcp.grants.list_all_malformed", { userId, count: items.length });
        setErrorCode("invalid_grant_response");
        setState("error");
        return;
      }
      if (malformed > 0) {
        logger.warn("mcp.grants.list_partial_malformed", { userId, malformed });
      }
      setGrants(mapped);
      setState("ready");
    } catch (err) {
      logger.warn("mcp.grants.list_exception", { userId }, err);
      setErrorCode("grants_load_failed");
      setState("error");
    } finally {
      inflight.current = false;
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(
    async (clientId: string): Promise<{ error: McpErrorCode | null }> => {
      const oauth = getOAuthAdapter();
      if (!oauth) return { error: "oauth_unavailable" };
      try {
        const response = await oauth.revokeGrant({ clientId });
        if (response?.error) {
          logger.warn("mcp.grants.revoke_failed", { clientId }, response.error);
          return { error: "grant_revoke_failed" };
        }
        // Não removemos otimista: confirmamos com o servidor via reload.
        return { error: null };
      } catch (err) {
        logger.warn("mcp.grants.revoke_exception", { clientId }, err);
        return { error: "grant_revoke_failed" };
      }
    },
    [],
  );

  return { state, grants, errorCode, reload: load, revoke };
}