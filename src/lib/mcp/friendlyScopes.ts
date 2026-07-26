/**
 * friendlyScopes — Traduz escopos OAuth técnicos em rótulos amigáveis pt-BR.
 *
 * A UI da Central MCP nunca deve exibir escopos crus (`openid`, `authenticated`)
 * sem tradução — isso confunde o usuário final. Escopos desconhecidos aparecem
 * como "Permissão adicional" para não vazar strings técnicas cruas em áreas
 * públicas da interface.
 */

const SCOPE_LABELS: Record<string, string> = {
  openid: "Identidade da conta",
  email: "E-mail da conta",
  profile: "Perfil básico",
  authenticated: "Acesso autenticado aos dados permitidos por RLS",
  offline_access: "Acesso continuado enquanto o assistente estiver conectado",
};

export function translateScope(scope: string): string {
  const key = scope?.trim().toLowerCase();
  if (!key) return "Permissão adicional";
  return SCOPE_LABELS[key] ?? "Permissão adicional";
}

export function translateScopes(scopes: readonly string[] | undefined | null): string[] {
  if (!Array.isArray(scopes)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of scopes) {
    if (typeof s !== "string") continue;
    const label = translateScope(s);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

/**
 * formatGrantDate — Formata data de autorização em pt-BR ou retorna
 * "Data não disponível" quando inválida (nunca exibe "Invalid Date").
 */
export function formatGrantDate(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined || input === "") return "Data não disponível";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "Data não disponível";
  try {
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "Data não disponível";
  }
}