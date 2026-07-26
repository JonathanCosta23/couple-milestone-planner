import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * useMcpConnections — lista e revoga grants OAuth 2.1 do próprio usuário
 * usando `supabase.auth.oauth`. É read-only em relação ao plano; apenas
 * gerencia autorizações de assistentes externos (ChatGPT, Claude, etc.).
 *
 * Estados possíveis:
 *  - `loading`        primeira carga em andamento
 *  - `unavailable`    servidor OAuth não habilitado / SDK sem suporte
 *  - `unauthenticated` usuário deslogado
 *  - `ready`          grants disponíveis (pode ser lista vazia)
 *  - `error`          falha transitória — permite retry
 */

export interface McpGrantSummary {
  clientId: string;
  name: string;
  uri: string;
  logoUri: string;
  scopes: string[];
  grantedAt: string;
}

export type McpConnectionsState =
  | "loading"
  | "unavailable"
  | "unauthenticated"
  | "ready"
  | "error";

interface OAuthNamespace {
  listGrants: () => Promise<{
    data: Array<{
      client: { id: string; name: string; uri: string; logo_uri: string };
      scopes: string[];
      granted_at: string;
    }> | null;
    error: { message?: string } | null;
  }>;
  revokeGrant: (options: { clientId: string }) => Promise<{
    error: { message?: string } | null;
  }>;
}

function getOAuthApi(): OAuthNamespace | null {
  // `auth.oauth` é beta no @supabase/supabase-js — o wrapper local mantém
  // o typing estreito à parte do namespace do SDK.
  const auth = supabase.auth as unknown as { oauth?: OAuthNamespace };
  return auth.oauth ?? null;
}

export function useMcpConnections(userId: string | null | undefined) {
  const [state, setState] = useState<McpConnectionsState>("loading");
  const [grants, setGrants] = useState<McpGrantSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setGrants([]);
      setErrorMessage(null);
      setState("unauthenticated");
      return;
    }
    const oauth = getOAuthApi();
    if (!oauth) {
      setState("unavailable");
      return;
    }
    setState("loading");
    setErrorMessage(null);
    try {
      const { data, error } = await oauth.listGrants();
      if (error) {
        logger.warn("mcp.grants.list_failed", { userId }, error);
        setErrorMessage(error.message ?? "Falha ao listar conexões.");
        setState("error");
        return;
      }
      const mapped: McpGrantSummary[] = (data ?? []).map((g) => ({
        clientId: g.client.id,
        name: g.client.name,
        uri: g.client.uri,
        logoUri: g.client.logo_uri,
        scopes: g.scopes ?? [],
        grantedAt: g.granted_at,
      }));
      setGrants(mapped);
      setState("ready");
    } catch (err) {
      logger.warn("mcp.grants.list_exception", { userId }, err);
      setErrorMessage(
        err instanceof Error ? err.message : "Não foi possível carregar as conexões.",
      );
      setState("error");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(
    async (clientId: string): Promise<{ error: string | null }> => {
      const oauth = getOAuthApi();
      if (!oauth) return { error: "Recurso indisponível neste ambiente." };
      try {
        const { error } = await oauth.revokeGrant({ clientId });
        if (error) {
          logger.warn("mcp.grants.revoke_failed", { clientId }, error);
          return { error: error.message ?? "Falha ao revogar." };
        }
        setGrants((prev) => prev.filter((g) => g.clientId !== clientId));
        return { error: null };
      } catch (err) {
        logger.warn("mcp.grants.revoke_exception", { clientId }, err);
        return {
          error:
            err instanceof Error ? err.message : "Não foi possível revogar agora.",
        };
      }
    },
    [],
  );

  return { state, grants, errorMessage, reload: load, revoke };
}