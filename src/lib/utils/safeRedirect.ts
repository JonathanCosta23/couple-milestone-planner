/**
 * safeRedirect — Sanitiza o parâmetro `redirect` (ou similar) de URLs internas.
 *
 * Regras:
 *  - Aceita apenas destinos internos (mesmo host), começando com "/".
 *  - Rejeita "//host" (protocolo-relativo) e "/\\host".
 *  - Rejeita esquemas absolutos (`javascript:`, `http:`, `https:`, `data:`, etc.).
 *  - Se `allowList` for informado, o pathname deve constar da lista.
 *  - Sempre retorna string (fallback quando inválido).
 */

export function sanitizeReturnTo(
  raw: string | null | undefined,
  fallback: string,
  allowList?: readonly string[],
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value) return fallback;
  // Deve começar com "/" e não ser protocol-relative ("//" ou "/\").
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Rejeita esquemas embutidos (defesa em profundidade).
  if (/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;

  // Extrai pathname (ignora querystring/hash na comparação com allowList).
  const pathname = value.split(/[?#]/)[0];
  if (allowList && !allowList.includes(pathname)) return fallback;
  return value;
}