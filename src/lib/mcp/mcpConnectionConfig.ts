/**
 * mcpConnectionConfig — Fonte única para configuração e strings da Central MCP.
 *
 * Objetivos:
 *  - Validar `projectRef` no boot para não emitir URLs `https://.supabase.co`.
 *  - Centralizar a URL do endpoint MCP (evita duplicação em Connect.tsx e no painel).
 *  - Concentrar a lista canônica de dados acessíveis e a descrição do escopo
 *    somente leitura, para que a UI nunca reescreva sozinha.
 *
 * Toda mensagem exposta na UI é humana, curta e específica; nenhum detalhe
 * técnico (ID do projeto, variável de ambiente, etc.) é vazado.
 */

import { logger } from "@/lib/logger";

const RAW_PROJECT_REF =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? "";

// projectRef válido: alfanumérico com hífens, entre 8 e 64 chars.
const PROJECT_REF_PATTERN = /^[a-z0-9-]{8,64}$/i;

function resolveProjectRef(): string | null {
  const trimmed = RAW_PROJECT_REF.trim();
  if (!trimmed) {
    logger.warn("mcp.config.project_ref_missing");
    return null;
  }
  if (!PROJECT_REF_PATTERN.test(trimmed)) {
    logger.warn("mcp.config.project_ref_invalid");
    return null;
  }
  return trimmed;
}

export const projectRef: string | null = resolveProjectRef();

export const mcpEndpoint: string | null = projectRef
  ? `https://${projectRef}.supabase.co/functions/v1/mcp`
  : null;

export const endpointAvailable: boolean = mcpEndpoint !== null;

/** Lista canônica de categorias de dados acessíveis via MCP (somente leitura). */
export const MCP_DATA_ACCESSED: readonly string[] = [
  "Seu plano atual e a meta financeira",
  "Participantes ativos do plano",
  "Ativos e investimentos cadastrados",
  "Histórico mensal de aportes",
] as const;

export const MCP_READONLY_DESCRIPTION =
  "O assistente conectado vê apenas os seus dados e não cria, altera ou apaga nada.";

export const MCP_ENDPOINT_UNAVAILABLE_MESSAGE =
  "A integração MCP não está disponível neste ambiente.";