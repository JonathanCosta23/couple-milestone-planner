/**
 * friendlyError — Mapeia erros crus do Supabase/Postgres para mensagens
 * amigáveis em português, evitando vazamento de detalhes internos
 * (nomes de tabela, constraints, colunas) para a UI.
 *
 * Uso:
 *   const friendly = toFriendlyError(error);
 *   toast.error(`Falha ao salvar: ${friendly}`);
 *
 * O erro cru é logado apenas no logger central para diagnóstico.
 */

import { logger } from "@/lib/logger";

type MaybeError =
  | string
  | null
  | undefined
  | { message?: string; code?: string; details?: string; hint?: string };

const CODE_MAP: Record<string, string> = {
  "23503": "Referência inválida entre registros.",
  "23505": "Este registro já existe.",
  "23502": "Campo obrigatório não preenchido.",
  "23514": "Valor fora do permitido.",
  "22P02": "Formato de dado inválido.",
  "42501": "Sem permissão para esta operação.",
  "42P01": "Recurso indisponível no momento.",
  PGRST301: "Sessão expirada. Faça login novamente.",
  PGRST116: "Registro não encontrado.",
};

const MESSAGE_PATTERNS: Array<{ test: RegExp; friendly: string }> = [
  // Códigos fechados vindos das triggers/RPCs do Plano do Milhão. Mantidos
  // no topo para preceder padrões genéricos (ex.: "check violation").
  { test: /explicit_reintegration_required/, friendly: "Este participante precisa ser reintegrado por um fluxo específico." },
  { test: /member_not_active/, friendly: "Este participante não está ativo." },
  { test: /member_scope_mismatch/, friendly: "Não foi possível associar este registro ao participante selecionado." },
  { test: /member_not_found/, friendly: "Participante não encontrado." },
  { test: /partner_already_active/, friendly: "Já existe um parceiro ativo neste plano." },
  { test: /partner_not_active/, friendly: "Não há parceiro ativo para remover." },
  { test: /plan_not_found/, friendly: "Plano não encontrado." },
  { test: /invalid_payload/, friendly: "Dados inválidos para esta operação." },
  { test: /unauthorized/, friendly: "Sessão expirada. Faça login novamente." },
  { test: /foreign key/i, friendly: "Referência inválida entre registros." },
  { test: /duplicate key|unique constraint/i, friendly: "Este registro já existe." },
  { test: /not[- ]?null/i, friendly: "Campo obrigatório não preenchido." },
  { test: /permission denied|rls|row[- ]level security/i, friendly: "Sem permissão para esta operação." },
  { test: /jwt|auth/i, friendly: "Sessão expirada. Faça login novamente." },
  { test: /network|fetch|failed to fetch/i, friendly: "Sem conexão. Tente novamente." },
  { test: /timeout/i, friendly: "Tempo esgotado. Tente novamente." },
];

const FALLBACK = "Não foi possível concluir agora. Tente novamente.";

export function toFriendlyError(err: MaybeError): string {
  if (!err) return FALLBACK;

  const raw =
    typeof err === "string"
      ? { message: err, code: undefined as string | undefined }
      : { message: err.message ?? "", code: err.code };

  logger.warn("supabase.friendly_error.raw", {}, err);

  if (raw.code && CODE_MAP[raw.code]) return CODE_MAP[raw.code];

  for (const { test, friendly } of MESSAGE_PATTERNS) {
    if (test.test(raw.message)) return friendly;
  }

  return FALLBACK;
}
