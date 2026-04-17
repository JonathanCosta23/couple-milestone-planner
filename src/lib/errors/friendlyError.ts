/**
 * friendlyError — Mapeia erros crus do Supabase/Postgres para mensagens
 * amigáveis em português, evitando vazamento de detalhes internos
 * (nomes de tabela, constraints, colunas) para a UI.
 *
 * Uso:
 *   const friendly = toFriendlyError(error);
 *   toast.error(`Falha ao salvar: ${friendly}`);
 *
 * O erro cru é logado apenas no console para diagnóstico.
 */

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

  // Log cru apenas no console (diagnóstico).
  if (typeof console !== "undefined") {
    console.warn("[supabase] erro:", err);
  }

  if (raw.code && CODE_MAP[raw.code]) return CODE_MAP[raw.code];

  for (const { test, friendly } of MESSAGE_PATTERNS) {
    if (test.test(raw.message)) return friendly;
  }

  return FALLBACK;
}
